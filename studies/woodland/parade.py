"""The wind-up woodland band: original turned, sewn and enamelled toy miniatures.

blender -b -t 4 --python-exit-code 1 -P studies/woodland/parade.py -- 1 proof
blender -b -t 4 --python-exit-code 1 -P studies/woodland/parade.py -- 1 render
The same projected local coordinates drive the enamel badges and game overlays.
"""
import json
import sys
from math import atan2, cos, pi, sin, sqrt, tau
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--') + 1:]
level, mode = int(args[0]), args[1]
count = (72, 80, 88)[level - 1]
poster = (37,41,41)[level-1]
out = ROOT / 'assets/videos/woodland' / f'parade-{level}'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
collection = scene.collection
V = Vector


def mat(name, hexcolor, rough=.43, metal=0):
    def lin(ch):
        v = int(ch, 16) / 255
        return v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4
    rgb = tuple(lin(hexcolor[i:i+2]) for i in (0, 2, 4))
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb, 1); m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*rgb,1)
    b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
    return m


ink=mat('Blue-black glass', '24232D',.22); white=mat('Ivory milk paint','FFF0CC')
butter=mat('Waxed boxwood','EFC682'); oak=mat('Cut cherry','B86B43'); wood=mat('Dark walnut','75422F')
deep=mat('Deep petrol enamel','164C51'); teal=mat('Peacock lacquer','268F88',.32)
mint=mat('Pistachio enamel','ABCE9F'); red=mat('Vermilion','CC513F'); plum=mat('Ox-blood','813745')
gold=mat('Satin brass','E6A33F',.32,.44); lightgold=mat('Polished rim','FFCD72',.25,.47)
skin=mat('Dormouse velvet','BA8B78'); pink=mat('Rose ear lining','F4A39B'); cream=mat('Biscuit fur','F9D7A0')
hare=mat('Hare fawn','D8A26F'); fox=mat('Fox russet','D16C3F'); hedge=mat('Chestnut pelt','87523D')
darkfur=mat('Umber tips','533C38'); bellinside=mat('Inside brass bell','925529',.39,.32)
stamp=mat('Honey stamp relief','CF9852'); diskmat=mat('Buttermilk enamel','FFE1A0')


def put(name, data=None, parent=None, loc=(0,0,0)):
    o=bpy.data.objects.new(name,data); collection.objects.link(o); o.parent=parent; o.location=loc
    return o


def geom(name, vs, fs, m, smooth=False):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vs,[],fs); mesh.materials.append(m); mesh.update()
    if smooth:
        for f in mesh.polygons: f.use_smooth=True
    return mesh


cache={}
def turned(name, p, loc, profile, m, sides=32):
    # profile follows the Z axis. Repeated end rings allow a crisp lip or foot.
    key=('turn',tuple(profile),m.name,sides)
    if key not in cache:
        vs=[(r*cos(tau*j/sides),r*sin(tau*j/sides),z) for r,z in profile for j in range(sides)]
        fs=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
            for i in range(len(profile)-1) for j in range(sides)]
        cache[key]=geom(name,vs,fs,m,True)
    return put(name,cache[key],p,loc)


def ell(name,p,loc,scale,m,roll=0,lean=0):
    o=turned(name,p,loc,[(max(.0001,cos(-pi/2+pi*i/16)),sin(-pi/2+pi*i/16)) for i in range(17)],m)
    o.scale=scale; o.rotation_euler=(lean,roll,0); return o


def box(name,p,loc,size,m,bevel=.05):
    x,y,z=[v/2 for v in size]; key=('box',size,m.name)
    if key not in cache:
        vs=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
        cache[key]=geom(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m)
    o=put(name,cache[key],p,loc)
    if bevel:
        b=o.modifiers.new('Sanded edges','BEVEL'); b.width=bevel; b.segments=3
        o.modifiers.new('Plane normals','WEIGHTED_NORMAL')
    return o


def cord(name,p,points,r,m,close=False):
    d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.resolution_u=6
    d.bevel_depth=r; d.bevel_resolution=3; d.use_fill_caps=True; d.materials.append(m)
    s=d.splines.new('BEZIER'); s.bezier_points.add(len(points)-1); s.use_cyclic_u=close
    for b,pt in zip(s.bezier_points,points):
        b.co=pt; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    return put(name,d,p)


def rod(name,p,a,b,r,m,r2=None):
    delta=V(b)-V(a); length=delta.length
    o=turned(name,p,a,[(.0001,0),(r,0),(r,length*.04),(r if r2 is None else r2,length),(.0001,length)],m,20)
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return o


def coin(name,p,loc,r,d,m):
    o=turned(name,p,loc,[(.0001,-d/2),(r*.94,-d/2),(r,-d*.32),(r,d*.32),(r*.95,d/2),(.0001,d/2)],m,48)
    o.rotation_euler.x=pi/2; return o


def ring(name,p,loc,r,t,m):
    profile=[(r+t*cos(tau*i/12),t*sin(tau*i/12)) for i in range(13)]
    o=turned(name,p,loc,profile,m,48); o.rotation_euler.x=pi/2; return o


def shape(name,p,loc,outline,d,m,bevel=.014):
    # A cut sheet of felt, in the XZ plane, with genuinely rounded cut edges.
    vs=[(x,y,z) for y in (-d/2,d/2) for x,z in outline]; n=len(outline)
    fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    o=put(name,geom(name,vs,fs,m),p,loc); mod=o.modifiers.new('Rolled edge','BEVEL'); mod.width=bevel; mod.segments=3
    o.modifiers.new('Flat enamel normals','WEIGHTED_NORMAL'); return o


def star(name,p,loc,r,m,n=5):
    return shape(name,p,loc,[(r*(1 if i%2==0 else .48)*cos(pi/2+pi*i/n),r*(1 if i%2==0 else .48)*sin(pi/2+pi*i/n)) for i in range(2*n)],.035,m)


train=put('Wind-up parade'); wheels=[]; badges=[]; crowns=[]; rigs=[]; flags=[]; keys=[]; scarves=[]; hornrigs=[]; tow=None


def wheel(p,x,y,r):
    w=put('Spoked wheel turning on its axle',None,p,(x,y,r)); wheels.append((w,r))
    ring('Walnut tire',w,(0,0,0),r-.047,.047,wood); ring('Painted felloe',w,(0,-.028,0),r-.088,.047,red)
    ring('Gold pinstripe',w,(0,-.066,0),r-.059,.009,lightgold)
    for i in range(7):
        a=tau*i/7
        ell('Turned wheel spoke',w,((r-.07)*.52*sin(a),0,(r-.07)*.52*cos(a)),(.034,.036,(r-.05)*.53),butter,a)
    coin('Brass hub',w,(0,-.035,0),.098,.12,gold); coin('Hub button',w,(0,-.102,0),.047,.03,deep)


def relief(p,kind,r):
    f=put('Stamp engraving',None,p,(0,-.117,0)); f.scale=(r,r,r)
    if kind=='acorn':
        ell('Acorn kernel',f,(0,0,-.059),(.28,.038,.32),stamp,.17)
        ell('Acorn cup',f,(-.035,-.030,.136),(.313,.049,.14),oak,.17)
        cord('Acorn stem',f,[(-.052,0,.22),(-.034,0,.35),(.06,0,.40)],.042,oak)
        cord('Kernel glint',f,[(-.10,-.042,-.005),(-.125,-.04,-.095),(-.08,-.04,-.18)],.021,diskmat)
    elif kind=='leaf':
        shape('Linden leaf',f,(0,-.012,0),[(-.30,-.20),(-.33,.04),(-.22,.20),(.02,.28),(.34,.33),(.27,.04),(.12,-.20),(-.13,-.25)],.05,stamp)
        cord('Leaf vein',f,[(-.36,-.051,-.31),(0,-.056,.01),(.22,-.054,.21)],.026,oak)
    else:
        star('Morning star',f,(0,-.018,0),.41,stamp,6); coin('Star heart',f,(0,-.053,0),.117,.036,diskmat)


def badge(p,x,r,kind):
    b=put(kind+' picture cartouche',None,p,(x,-.434,1.012)); badges.append((b,1.58*r))
    coin('Raised bezel',b,(0,0,0),r,.12,gold); coin('Cream picture field',b,(0,-.065,0),r*.91,.045,diskmat)
    ring('Stamped inner line',b,(0,-.094,0),r*.82,.012,stamp); relief(b,kind,r)
    for i in range(8):
        a=tau*i/8+pi/8; ell('Bezel pin',b,(r*.948*cos(a),-.049,r*.948*sin(a)),(.014,.015,.014),lightgold)


def cart(cx,span,r,places):
    base=put('Wagon axles',None,train,(cx,0,0)); p=put('Suspended carriage',None,base)
    for x in (-span*.37,span*.37):
        rod('Axle',base,(x,-.48,r),(x,.41,r),.066,wood)
        for y in (.37,-.49): wheel(base,x,y,r)
    box('Curved timber chassis',p,(0,0,.50),(span+.10,.85,.24),wood,.10)
    box('Painted carriage',p,(0,0,.99),(span,.77,.91),teal if level!=2 else plum,.135)
    box('Boxwood rim',p,(0,0,1.42),(span+.10,.84,.13),butter,.048)
    box('Coachwork lower stripe',p,(0,-.012,.595),(span+.04,.79,.10),gold,.034)
    for x in (-span*.48,span*.48):
        box('Corner moulding',p,(x,-.36,1.01),(.082,.095,.73),gold,.032)
    for x,rad,icon in places: badge(p,x,rad,icon)
    return base,p


def key(p,loc,scale=1):
    k=put('Double-lobed winding key',None,p,loc); k.scale=(scale,scale,scale); keys.append(k)
    rod('Winding spindle',k,(0,0,0),(-.25,0,.13),.050,gold)
    for a in (-1,1):
        q=ring('Bow of key',k,(-.27-.045*a,-.014,.14+.105*a),.10,.036,lightgold); q.scale.x=.83


def arm(p,loc,end,coat,fur):
    pivot=put('Swinging shoulder',None,p,loc); v=V(end)
    rod('Uniform sleeve',pivot,(0,0,0),tuple(v*.73),.116,coat,.098)
    ell('Cuff braid',pivot,tuple(v*.73),(.105,.099,.070),gold)
    ell('Mitten paw',pivot,tuple(v*.96),(.119,.098,.116),fur); return pivot


def ear(p,kind,x,back):
    y=.055 if back else -.085
    if kind=='mouse':
        rr=.34 if not back else .30
        ell('Saucer ear',p,(x,y,.36),(rr,.117,rr*1.11),skin, -.24 if x<0 else .2)
        ell('Rose velvet inside ear',p,(x,y-.08,.375),(rr*.73,.062,rr*.78),pink)
    elif kind=='hare':
        tilt=-.24 if x<0 else .16
        ell('Long hare ear',p,(x,y,.61),(.174,.13,.521),hare,tilt)
        ell('Woven ear lining',p,(x,y-.092,.64),(.091,.051,.391),pink,tilt)
    elif kind=='fox':
        outline=[(-.17,-.05),(-.12,.19),(.01,.45),(.16,.18),(.21,-.07)]
        shape('Fox ear',p,(x,y,.28),outline,.20,fox,.045)
        shape('Inner ear',p,(x,y-.109,.32),[(-.095,0),(.018,.26),(.12,.012)],.04,darkfur,.027)
    elif kind=='hedge':
        ell('Little folded ear',p,(x,y,.24),(.145,.095,.151),hedge)
        ell('Ear lining',p,(x,y-.07,.247),(.087,.042,.09),pink)


def animal(kind,base,loc,s,coat,marching,phase,role):
    global tow
    fur={'mouse':skin,'hare':hare,'fox':fox,'hedge':cream}[kind]
    origin=put(kind+' station',None,base,loc); origin.scale=(s,s,s)
    hip=put(kind+' sprung hips',None,origin,(0,0,.65)); body=put(kind+' body',None,hip)
    jacket=ell('Painted tunic',body,(0,0,.39),(.398,.325,.53),coat,-.09)
    ell('Tunic skirt',body,(-.026,0,.116),(.382,.319,.21),coat)
    ell('Belt',body,(-.016,-.004,.226),(.386,.331,.09),deep)
    box('Belt buckle',body,(.028,-.329,.226),(.13,.055,.098),gold,.022)
    ell('Neck kerchief',body,(.038,-.010,.744),(.332,.301,.149),red if coat!=red else teal)
    tailcloth=shape('Trailing neckerchief',body,(-.20,.054,.72),[(0,.09),(-.26,.08),(-.49,.20),(-.41,-.012),(-.51,-.11),(-.19,-.085),(0,-.04)],.074,red if coat!=red else teal,.028); scarves.append((tailcloth,phase))
    for i in (0,1): ell('Tunic button',body,(.025,-.315,.42+i*.14),(.038,.038,.04),lightgold)
    for x in (-.27,.27):
        ell('Braided epaulette',body,(x,-.085,.66),(.131,.144,.063),gold,-.18 if x<0 else .18)
    cord('Jacket braid',body,[(-.258,-.218,.60),(-.153,-.301,.528),(-.04,-.322,.525)],.014,butter)
    if role=='conduct':
        for j in range(2):
            cord('Fanfare braid',body,[(-.23,-.231,.49-j*.095),(-.105,-.311,.45-j*.095),(.038,-.321,.48-j*.095)],.016,gold)
    head=put(kind+' head',None,body,(.035,-.012,1.074)); head.rotation_euler.z=.20
    if kind=='hedge':
        ell('Hedgehog mantle',head,(-.09,.055,.035),(.555,.385,.475),hedge)
        for j in range(13):
            a=-.24+j*.215; x=-.45*cos(a); z=.40*sin(a)
            ell('Carved quill',head,(x-.09,-.018,z+.045),(.104,.20,.19),wood if j%3 else darkfur,-pi/2+a-.32)
        for j in range(7):
            a=.26+j*.311; z=.392*sin(a); x=-.431*cos(a)
            rod('Chestnut quill tip',head,(x-.08,-.155,z), (x-.195,-.12,z+.094+.076*sin(a)),.061,hedge,.008)
        ell('Hedgehog face',head,(.102,-.16,-.031),(.373,.285,.33),cream)
    else:
        ell('Head',head,(0,0,.013),(.475,.37,.427),fur)
    ear(head,kind,-.279,False); ear(head,kind,.27,True)
    # The two cheeks converge into a raised nose; a real mouth seam sits beneath it.
    if kind=='fox':
        for mirror in (-1,1):
            shape('Ivory cheek ruff',head,(mirror*.26,-.20,-.15),[(mirror*x,z) for x,z in [(-.155,.054),(.07,.123),(.258,.117),(.191,.013),(.236,-.028),(.05,-.139),(-.126,-.079)]],.13,cream,.044)
    for x in (-.113,.170):
        ell('Cream muzzle',head,(x+.054,-.294,-.113),(.213,.202 if kind=='fox' else .17,.149),cream if kind!='hare' else white)
    for x,y in ((-.165,-.330),(.237,-.306)):
        ell('Glass eye socket',head,(x,y,.077),(.093,.065,.111),darkfur)
        ell('Obsidian eye',head,(x+.009,y-.038,.078),(.070,.051,.087),ink)
        ell('Eye light',head,(x-.010,y-.084,.108),(.023,.013,.024),white)
    nx=.095
    ell('Button nose',head,(nx,-.493 if kind=='fox' else -.457,-.073),(.093,.063,.064),plum if kind=='mouse' else ink)
    cord('Stitched smile',head,[(nx,-.452,-.119),(nx-.018,-.446,-.170),(nx-.085,-.441,-.175)],.012,wood)
    if kind in ('mouse','hare'):
        for side in (-1,1):
            for j in (0,1):
                x=nx+side*.19
                cord('Bristle',head,[(x,-.424,-.112-j*.055),(x+side*.105,-.449,-.119-j*.05),(x+side*.20,-.434,-.084-j*.109)],.0075,wood)
    if kind=='fox':
        ell('Brush',body,(-.44,.125,.25),(.236,.219,.58),fox,-.91)
        ell('Brush tip',body,(-.762,.125,.49),(.181,.182,.239),cream,-.90)
    elif kind=='mouse':
        cord('Leather mouse tail',body,[(-.19,.16,.08),(-.50,.17,.045),(-.73,.12,.25),(-.71,.10,.41)],.034,pink)
    elif kind=='hare': ell('Powder puff tail',body,(-.366,.15,.18),(.194,.177,.183),white)
    crowns.append((head,(0,-.13,.38 if kind!='hedge' else .43),.86))
    legs=[]
    for side in (-1,1):
        leg=put('Pendulum leg',None,hip,(side*.135,-.023+side*.125,0))
        knee=put('Hinged knee',None,leg,(0,0,-.259)); legs.append((leg,knee))
        rod('Stocking',knee,(0,0,.022),(0,0,-.218),.097,butter,.080)
        ell('Trouser knee',leg,(0,0,-.15),(.123,.111,.20),deep)
        ell('Boot collar',knee,(0,0,-.177),(.105,.112,.081),red)
        ell('Boot',knee,(.063,-.02,-.271),(.195,.137,.119),wood,-.07)
    arms=[]
    for i,(shoulder,end) in enumerate([((-.253,.075,.607),(-.285,-.048,-.29)),((.263,-.15,.607),(.199,-.08,-.279))]):
        if role in ('drum','cymbals','horn','trumpet'): end=((- .078 if i==0 else .058),-.245,-.157)
        if role=='conduct' and i==1: end=(.295,-.119,.086)
        a=arm(body,shoulder,end,coat,fur); arms.append(a)
        if role=='tow' and i==0: tow=put('Paw grip',None,a,end)
        if role=='conduct' and i==1:
            rod('Lacquer conducting baton',a,end,(end[0]+.28,end[1]-.02,end[2]+.59),.037,deep,.018)
            rod('Baton grip',a,end,(end[0]+.065,end[1]-.005,end[2]+.14),.042,gold,.034)
            ell('Baton tip',a,(end[0]+.28,end[1]-.02,end[2]+.59),(.048,.047,.051),red)
        if role=='drum':
            tip=(end[0]+(.15 if i==0 else -.17),end[1]-.22,end[2]+.25)
            rod('Maple drumstick',a,end,tip,.028,gold); ell('Mallet head',a,tip,(.059,.059,.059),red)
        if role=='cymbals':
            c=coin('Hammered cymbal',a,(end[0],end[1]-.12,end[2]),.235,.039,gold); c.rotation_euler.z=(-.71 if i==0 else .65)
            ell('Cymbal boss',a,(end[0],end[1]-.153,end[2]),(.063,.033,.07),lightgold)
    if role=='drum':
        d=put('Side drum',None,body,(.102,-.438,.28)); d.rotation_euler.x=.13
        turned('Lacquer drum',d,(0,0,0),[(.0001,-.19),(.285,-.19),(.286,.18),(.0001,.18)],red)
        for z in (-.169,.17): turned('Brass drum hoop',d,(0,0,z),[(.0001,-.025),(.299,-.025),(.30,.024),(.0001,.024)],gold)
        turned('Taut vellum',d,(0,0,.192),[(.0001,0),(.271,0),(.273,.008),(.0001,.009)],white)
        for j in range(8):
            a=tau*j/8; b=tau*(j+.45)/8
            rod('Tension rope',d,(.289*cos(a),.289*sin(a),-.153),(.291*cos(b),.291*sin(b),.154),.017,white)
    if role in ('horn','trumpet'):
        h=put('Coiled woodland horn',None,body,(.12,-.405,.61)); hornrigs.append((h,phase))
        if role=='horn':
            cord('Coil of horn',h,[(0,-.02,.25),(-.14,-.04,.10),(-.24,-.06,-.19),(-.09,-.077,-.34),(.10,-.085,-.32),(.216,-.073,-.18),(.18,-.05,-.039),(.048,-.04,-.027),(-.041,-.055,-.139),(.045,-.09,-.204),(.23,-.12,-.12),(.31,-.14,.025)],.044,gold)
        else:
            cord('Folded cornet',h,[(.01,-.018,.254),(.22,-.055,.128),(.322,-.089,.026),(.285,-.097,-.097),(.012,-.102,-.204),(-.13,-.109,-.17),(-.15,-.112,-.064),(-.04,-.118,-.018),(.28,-.125,-.023)],.045,gold)
            for j in range(3):
                x=-.043+.091*j; rod('Valve chamber',h,(x,-.116,-.153),(x,-.12,.082),.028,gold)
                ell('Valve pearl',h,(x,-.12,.09),(.042,.041,.029),white)
        o=turned('Open flaring brass bell',h,(.28,-.125,-.023),[(.05,0),(.061,.10),(.094,.21),(.164,.33),(.26,.41),(.265,.432),(.246,.44),(.156,.366),(.081,.25),(.039,.15),(.0001,.14)],gold,48)
        o.rotation_euler=V((.92,-.32,.33) if role=='trumpet' else (.52,-.64,.60)).to_track_quat('Z','Y').to_euler(); o.data.materials.append(bellinside)
        for poly in o.data.polygons:
            if poly.index>=48*7: poly.material_index=1
        lip=turned('Rolled bell lip',o,(0,0,.433),[(.257+.016*cos(tau*j/12),.016*sin(tau*j/12)) for j in range(13)],lightgold,48)
    rigs.append((hip,body,head,legs,arms,marching,phase,role))
    return body


def pennant_chain(p):
    p=put('Raised pennant mast',None,p,(0,0,.24))
    for x in (-2.18,2.17):
        rod('Bandstand standard',p,(x,.29,1.17),(x,.29,4.17),.034,gold)
        ell('Standard finial',p,(x,.29,4.23),(.078,.078,.106),lightgold)
    cord('Pennant line',p,[(-2.18,.29,4.16),(-1.06,.30,3.96),(0,.30,3.91),(1.12,.30,3.97),(2.17,.29,4.16)],.024,butter)
    for j,m in enumerate([red,mint,gold,teal,red,mint,gold,teal,red]):
        x=-1.96+j*.49; z=3.91+.25*(x/2.18)**2
        f=put('Fluttering swallowtail',None,p,(x,.285,z)); flags.append((f,j))
        shape('Woven pennant',f,(0,0,0),[(-.195,0),(.195,0),(.111,-.35),(-.002,-.265),(-.137,-.355)],.030,m)
        ell('Pennant seed',f,(0,-.024,-.118),(.044,.014,.063),white,.22)


if level==1:
    base,spring=cart(-.99,1.73,.41,[(0,.688,'acorn')]); base.scale=(1.13,1.13,1.13)
    for x in (-.73,.73):
        ell('Cart corner acorn',spring,(x,.19,1.511),(.112,.115,.155),oak)
        ell('Acorn finial cap',spring,(x,.19,1.576),(.125,.125,.071),gold)
    # A single miniature trunk and two turned ends make the cart read as luggage.
    box('Lidded mail chest',spring,(0,.03,1.47),(1.38,.57,.32),oak,.15)
    for x in (-.50,.50): box('Mail chest strap',spring,(x,.022,1.487),(.099,.60,.325),butter,.045)
    key(spring,(-.86,-.10,1.12),1.05)
    body=animal('mouse',train,(1.17,-.027,0),1.34,deep,True,1.97,'tow')
    geom_cam=(6.10,-.14,1.92); travel=.94
elif level==2:
    base,spring=cart(-.99,3.15,.412,[(-.75,.66,'acorn'),(.75,.66,'leaf')])
    animal('hedge',spring,(-.12,.055,1.485),.94,teal,False,2.04,'cymbals')
    for x in (-1.35,1.36):
        rod('Passenger rail',spring,(x,.28,1.48),(x,.28,1.79),.045,gold)
        ell('Rail cap',spring,(x,.28,1.80),(.085,.085,.078),lightgold)
    cord('Rear passenger rail',spring,[(-1.35,.28,1.77),(0,.32,1.72),(1.36,.28,1.77)],.041,butter)
    key(spring,(-1.56,-.062,1.102))
    body=animal('hare',train,(1.755,-.066,0),1.17,deep,True,.76,'drum')
    geom_cam=(6.68,-.22,2.08); travel=.81
else:
    base,spring=cart(-.97,4.49,.442,[(-1.45,.655,'acorn'),(0,.655,'leaf'),(1.45,.655,'star')])
    animal('mouse',spring,(-1.14,-.02,1.48),.99,deep,False,.32,'horn')
    animal('hedge',spring,(.72,-.013,1.48),1.02,red,False,2.72,'trumpet')
    pennant_chain(spring); key(spring,(-2.215,-.094,.99),.95)
    body=animal('fox',train,(2.34,-.097,0),1.24,deep,True,-1.04,'conduct')
    geom_cam=(8.32,.08,2.65); travel=.66

if tow is None: tow=put('Belt hitch',None,body,(-.31,.12,.236))
swivel=put('Carriage hitch',None,spring,((.86,1.55,2.22)[level-1],.06,.67))
shaft=rod('Articulated drawbar',train,(0,0,0),(0,0,1),.045,butter)
ell('Brass hitch',swivel,(0,0,0),(.09,.091,.096),gold)


def light(name,at,power,color,size):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
    o=put(name,d,loc=at); o.rotation_euler=(V((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()


scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=14
scene.cycles.use_denoising=True; scene.cycles.max_bounces=3; scene.cycles.diffuse_bounces=2; scene.cycles.glossy_bounces=2
scene.render.use_persistent_data=True; scene.render.threads_mode='FIXED'; scene.render.threads=4
scene.render.resolution_x=480; scene.render.resolution_y=360; scene.render.resolution_percentage=100
scene.render.film_transparent=True; scene.render.fps=24; scene.frame_start=1; scene.frame_end=count
scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
scene.world=bpy.data.worlds.new('Softbox tent'); scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.78,.82,.87,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.43
light('Large warm key',(-4,-5,7),580,(1,.89,.76),5)
light('Book fill',(4,-4,4),335,(.76,.87,1),4)
light('Varnish edge',(-1,3,6),510,(1,.87,.69),3.6)
camera=bpy.data.cameras.new('Orthographic rostrum'); camera.type='ORTHO'; camera.ortho_scale=geom_cam[0]
aim=V((geom_cam[1],0,geom_cam[2])); cam=put('Fixed camera',camera,loc=aim+V((.94,-13,2.1))); scene.camera=cam
cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.image_settings.color_depth='8'
scene.render.image_settings.compression=25


def pose(frame):
    u=(frame-1)/(count-1); phase=tau*((frame-1)/(18.8 if level==1 else 18.1))
    # The train starts fully on stage. A small forward glide leaves room for the upbeat.
    dx=(u-.5)*travel; train.location.x=dx
    spring.location.z=.016*(1-cos(2*phase)); spring.rotation_euler.y=.013*sin(phase-.24)
    for w,r in wheels: w.rotation_euler.y=(dx+travel/2)/(r*base.scale.x)
    for hip,body,head,legs,arms,walk,off,role in rigs:
        a=phase+off; stride=.47 if walk else .085
        for i,(l,knee) in enumerate(legs):
            t=a+i*pi; lift=max(0,-cos(t))**1.5 if walk else 0
            l.rotation_euler.y=stride*sin(t)-.75*lift; knee.rotation_euler.y=1.51*lift
        ground=stride*sin(a if cos(a)>=0 else a+pi)
        hip.location.z=(.53*cos(ground)+.063*sin(ground)+sqrt((.195*sin(ground-.07))**2+(.119*cos(ground-.07))**2) if walk else .65+.013*(1-cos(2*a)))
        body.rotation_euler.y=.048*sin(a) if walk else .082*sin(a)
        body.rotation_euler.z=.044*cos(a); head.rotation_euler.y=-.075*sin(a+.63); head.rotation_euler.z=(.53 if role=='conduct' else .35)+.075*cos(a*.5)
        for i,arm_o in enumerate(arms):
            if role=='tow': arm_o.rotation_euler.y=(.07 if i==0 else .50)*sin(a+i*pi)
            if role=='drum': arm_o.rotation_euler.x=.46*sin(a*2+i*pi); arm_o.rotation_euler.y=.135*cos(a+i*pi)
            if role=='cymbals': arm_o.rotation_euler.z=(1 if i==0 else -1)*(.24+.47*sin(a)); arm_o.rotation_euler.x=.17*cos(a)
            if role=='conduct': arm_o.rotation_euler.y=(.39 if i==0 else .62)*sin(a+i*pi); arm_o.rotation_euler.z=.19*cos(a)
    for q,j in flags:
        q.rotation_euler.x=.26*sin(phase*1.4+j*.69); q.rotation_euler.y=.20+.15*cos(phase*1.4+j*.69); q.rotation_euler.z=.16*sin(phase*1.4+j*.69)
    for k in keys: k.rotation_euler.x=.63*sin(phase*.49)
    for f,o in scarves: f.rotation_euler.y=.162*sin(phase+o)
    for h,o in hornrigs: h.rotation_euler.y=.085*sin(phase+o); h.rotation_euler.x=.068*cos(phase+o)
    bpy.context.view_layer.update()
    inv=train.matrix_world.inverted(); start=inv@swivel.matrix_world.translation; delta=inv@tow.matrix_world.translation-start
    shaft.location=start; shaft.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); shaft.scale.z=delta.length
    bpy.context.view_layer.update()


def px(point):
    n=world_to_camera_view(scene,cam,point); return V((n.x*480,(1-n.y)*360))


def anchor(o,loc,width):
    w=o.matrix_world; l=V(loc); p=px(w@l); d=px(w@(l+V((width,0,0))))-p
    return [round(p.x,3),round(p.y,3),round(atan2(d.y,d.x),6),round(d.length,3)]


anchors=[]; hats=[]
proofs={1,poster-4,poster,count}
for frame in range(1,count+1):
    pose(frame)
    anchors.append([anchor(b,(0,-.10,0),width) for b,width in badges]); hats.append([anchor(*entry) for entry in crowns])
    if mode=='render' or (mode=='proof' and frame in proofs):
        scene.render.filepath=str(out/f'{frame:03}.png'); bpy.ops.render.render(write_still=True)
for name,data in [('anchors',anchors),('hats',hats)]:
    (out/f'{name}.json').write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf8')
