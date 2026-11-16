"""The First Curl / The Weaver's Arch / The Wisteria Gate.

From word-woods, with Blender 5.3:
    blender -b -t 4 -P studies/woodland/vines.py -- 1 [frame ...]
    python studies/woodland/pack.py vines 1 65
Use 2/73 or 3/81 for the other plates. Frame numbers are one-based.
All forms, pigments and movements are generated here; no linked assets.
"""
from bisect import bisect_right
from math import cos, sin, pi, radians, exp
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
COUNTS = {1: 72, 2: 80, 3: 88}
TAU = 2*pi
V = Vector
FRONT = V((0, 0, 1))

def clamp(v):
    return min(1, max(0, v))

def eased(a, b, x):
    t = clamp((x-a)/(b-a))
    return t*t*(3-2*t)

def ink(value):
    return tuple(int(value[i:i+2],16)/255 for i in (0,2,4))

def blend(a, b, u):
    return tuple(x+(y-x)*u for x,y in zip(a,b))

def direction(degrees):
    a = radians(degrees)
    return V((cos(a),sin(a),0))

def left(d):
    return V((-d.y,d.x,0)).normalized()

def bezier(a,b,c,d,t):
    s=1-t
    return a*s**3+b*(3*t*s*s)+c*(3*s*t*t)+d*t**3

# Inked undersides and raised, warmer ridges give the small leaves contrast.
LEAF = [tuple(map(ink, row)) for row in (
    ("193e42","347666","72b58a","bcce86"),
    ("264438","6e963e","abd06a","e2db8f"),
    ("1a4857","367e83","74b3a4","c6d6a0"),
    ("503f39","a96543","df945d","eed18b"),
    ("2c4938","51854f","93be71","cdda98"))]
BARK = tuple(map(ink,("383b36","836241","c4955c")))
TWIG = tuple(map(ink,("2c4b43","577851","b0ac68")))
COPPER = tuple(map(ink,("694035","b57249","e0ae72")))
GOLD = ink("e5c77c")

class Clay:
    def __init__(self):
        self.positions=[]
        self.faces=[]
        self.pigments=[]

    def point(self,p,col):
        self.positions.append((p.x,-p.y,p.z))
        self.pigments.extend((*col,1))

    def skin(self,rows,cols,fn):
        start=len(self.positions)
        for i in range(rows+1):
            for j in range(cols+1):
                self.point(*fn(i/rows,2*j/cols-1))
        for i in range(rows):
            for j in range(cols):
                k=start+i*(cols+1)+j
                self.faces.append((k,k+1,k+cols+2,k+cols+1))

    def pipe(self,centers,width,color,sides=8):
        if len(centers)<2:
            return
        start=len(self.positions)
        for i,p in enumerate(centers):
            tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
            across=left(tangent)
            normal=tangent.cross(across).normalized()
            t=i/(len(centers)-1)
            r=max(.012,width(t))
            for j in range(sides):
                a=TAU*j/sides
                ray=across*cos(a)+normal*sin(a)
                self.point(p+ray*r,color(t,ray))
                if i:
                    k=start+i*sides+j
                    h=start+i*sides+(j+1)%sides
                    self.faces.append((k-sides,h-sides,h,k))
        self.faces.append(tuple(start+j for j in reversed(range(sides))))
        end=start+(len(centers)-1)*sides
        self.faces.append(tuple(end+j for j in range(sides)))

    def mark(self,fn,width,pigment,n=8):
        """Fine raised vein, flattened between the edges like a brush stroke."""
        pts=[fn(i/n) for i in range(n+1)]
        start=len(self.positions)
        for i,p in enumerate(pts):
            side=left(pts[min(n,i+1)]-pts[max(0,i-1)])*width(i/n)
            self.point(p-side,pigment)
            self.point(p+side,pigment)
            if i:
                k=start+2*i
                self.faces.append((k-2,k-1,k+1,k))

    def bake(self,material):
        mesh=bpy.data.meshes.new("Living vine surfaces")
        mesh.from_pydata(self.positions,[],self.faces)
        attr=mesh.color_attributes.new(name="Gouache",type="BYTE_COLOR",domain="POINT")
        attr.data.foreach_set("color_srgb",self.pigments)
        for poly in mesh.polygons:
            poly.use_smooth=True
        mesh.materials.append(material)
        mesh.update()
        return mesh

def wood(palette):
    def color(t,ray):
        k=clamp(.45+.27*ray.z-.3*ray.y-.14*ray.x+.035*sin(11*t))
        return blend(palette[0],palette[1],k*2) if k<.5 else blend(palette[1],palette[2],2*k-1)
    return color

class Trail:
    """Length-parametrised Catmull-Rom through the illustrator's knots."""
    def __init__(self,knots):
        control=list(map(V,knots))
        self.points=[]
        for i in range(len(control)-1):
            p0,p1=control[max(0,i-1)],control[i]
            p2,p3=control[i+1],control[min(len(control)-1,i+2)]
            for j in range(20):
                t=j/20
                self.points.append((2*p1+(-p0+p2)*t+
                    (2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3)*.5)
        self.points.append(control[-1])
        self.dist=[0.]
        for a,b in zip(self.points,self.points[1:]):
            self.dist.append(self.dist[-1]+(b-a).length)
        self.length=self.dist[-1]

    def at(self,t):
        d=clamp(t)*self.length
        i=min(len(self.points)-2,bisect_right(self.dist,d)-1)
        return self.points[i].lerp(self.points[i+1],(d-self.dist[i])/(self.dist[i+1]-self.dist[i]))

    def tangent(self,t):
        return (self.at(t+.003)-self.at(t-.003)).normalized()

def path(points):
    return Trail([(x,y,z) for x,y,z in points])

FIRST=path([(173,324,1),(128,321,1),(83,304,3),(69,271,4),
            (83,231,3),(82,204,2),(66,177,2),(70,148,3),
            (96,112,4),(124,93,4),(146,97,4)])
ARCH_LEFT=path([(112,324,3),(80,314,2),(67,285,1),(82,251,3),
                (74,210,5),(72,168,3),(91,123,4),(130,89,5),
                (181,78,8),(221,63,3),(252,72,5),(285,62,9),(317,74,7)])
ARCH_RIGHT=path([(371,325,5),(396,307,3),(403,278,1),(385,239,4),
                 (395,195,3),(389,155,4),(367,118,6),(328,90,4),
                 (291,67,2),(259,68,10),(228,76,8),(199,64,2),(167,79,5)])
GATE_LEFT=path([(115,328,3),(78,315,4),(61,280,3),(83,235,2),
                (65,192,4),(68,155,5),(88,123,3),(112,91,3),
                (157,80,4),(192,53,6),(222,62,4),(240,45,6),(270,52,3)])
GATE_RIGHT=path([(360,328,6),(402,315,4),(416,280,4),(395,240,3),
                 (411,199,5),(410,161,6),(383,127,4),(366,98,5),
                 (323,83,6),(290,59,8),(263,68,6),(238,48,11),(209,54,6)])

def stem(mesh,trail,progress,radius,palette,braid=0):
    n=max(3,round(trail.length*progress/3.4))
    ts=[progress*i/n for i in range(n+1)]
    points=[trail.at(t) for t in ts]
    def root_taper(v):
        return .06+.94*eased(0,.095,v)
    def width(t):
        v=t*progress
        return radius*root_taper(v)*(1-.64*v)*(.3+.7*(1-eased(.955,1,t)))
    mesh.pipe(points,width,wood(palette),10)
    if braid:
        # A separate twiner follows a helix on the bark, disappearing behind
        # the parent at alternate crossings.
        wrapped=[]
        for t,p in zip(ts,points):
            side=left(trail.tangent(t)); a=TAU*(t*braid+.15)
            r=(radius*1.13+.25)*(1-.53*t)*root_taper(t)
            wrapped.append(p+side*(r*cos(a))+FRONT*(r*sin(a)))
        mesh.pipe(wrapped,lambda t:root_taper(t*progress)*(.35+radius*.25*(1-.75*t*progress)),
                  wood(COPPER),6)

def leaf(mesh,base,angle,length,width,stage,kind=0,pigment=0,turn=0):
    if stage<=.025:
        return
    # The tip initially hooks towards the petiole. It straightens as the two
    # halves peel away from the folded central rib.
    direction_now=direction(angle+(1-stage)*(30 if turn>=0 else -30))
    side=left(direction_now)
    edge,body,lit,rib=LEAF[pigment]
    age=.10+.9*stage
    def surface(t,s):
        taper=max(0,sin(pi*t**.78))**(.88 if kind==1 else .91)
        wing=exp(-((t-.41)/.105)**2)
        breadth=(.68+.46*wing+.15*exp(-((t-.20)/.08)**2)) if kind==0 else (.68+.18*t)
        reach=t-(1-stage)*.72*t*t*t
        if kind==0:
            reach+=abs(s)**1.5*taper*(.14*wing-.21*exp(-((t-.19)/.17)**2))
        curl=turn*.14*sin(pi*t)+(.31 if turn>=0 else -.31)*(1-stage)*t*t
        x=width*taper*breadth*s*(.17+.83*stage)
        x+=length*curl
        height=(length*.28*(1-stage)*sin(pi*t)
                +width*(.24*(1-abs(s))+.42*(1-stage)*abs(s))*taper
                +length*.105*t*t+width*.15*s*taper)
        p=base+age*(direction_now*(length*reach)+side*x+FRONT*height)
        k=clamp(.39-.38*s+.27*t+.09*cos(2.7*t+s*3.4+turn))
        col=blend(body,lit,k)
        col=blend(col,edge,.48*abs(s)**7+.17*(1-t))
        return p,col
    mesh.skin(23,10,surface)
    def line(t,s): return surface(t,s)[0]+FRONT*.26
    mesh.mark(lambda t:line(t,0),lambda t:max(.04,width*.063*age*(1-t)**.65),rib,15)
    pairs=3 if length>=22 else 2
    for j in range(pairs):
        foot=.16+.16*j
        for sign in (-1,1):
            mesh.mark(lambda t:line(foot+.22*t+.045*t*t,sign*.81*t),
                      lambda t:width*.028*age*(1-.83*t),blend(lit,rib,.44),6)

def leaf_at(mesh,trail,progress,station,deg,size,pigment,kind,turn):
    age=eased(station-.014,station+.10,progress)
    if age<.025: return
    base=trail.at(station)+FRONT*.9
    d=direction(deg)
    bend=left(d)*size*.09*turn
    petiole=size*(.21+.08*kind)
    joint=base+(d*petiole+bend+FRONT*1.8)*age
    mesh.pipe([base,base+d*(petiole*.45*age),joint],lambda t:age*(1.15-.57*t),wood(TWIG),6)
    leaf(mesh,joint,deg,size,size*(.43 if kind==0 else .28),age,kind,pigment,turn)

def spiral(mesh,base,d,radius,hand,turns,age,thick,palette):
    if age<.025: return
    side=left(d)*hand
    amax=turns*TAU
    # The initial tangent matches the incoming stalk. Each turn tightens
    # towards a real, round terminal, never crossing the preceding coil.
    def loc(t):
        a=amax*t; r=radius*(1-.82*t)
        return base+d*(sin(a)*r)+side*(radius-cos(a)*r)+FRONT*(1.2*t)
    n=max(5,round(48*turns*age))
    mesh.pipe([loc(age*i/n) for i in range(n+1)],
              lambda t:thick*(1-.81*t*age),wood(palette),7)

def scroll_at(mesh,trail,progress,station,deg,length,radius,hand):
    grow=eased(station,station+.18,progress)
    if grow<.02: return
    base=trail.at(station)+FRONT*1.0
    d=direction(deg); side=left(d)*hand
    end=base+d*length+side*(length*.17)+FRONT*1.8
    mid_a=base+d*length*.28-side*length*.23
    mid_b=end-d*length*.33
    trunk=min(1,grow/.57)
    mesh.pipe([bezier(base,mid_a,mid_b,end,trunk*i/12) for i in range(13)],
              lambda t:1.5-.52*t*trunk,wood(TWIG),7)
    spiral(mesh,end,d,radius,hand,1.20,eased(.50,1,grow),1.04,COPPER)

def terminal(mesh,trail,progress,radius,hand):
    d=trail.tangent(progress)
    root=trail.at(progress)
    spiral(mesh,root,d,radius*(.53+.47*progress),hand,1.26,1,
           1.35+.30*(1-progress),COPPER)
    # A pair of tightly folded copper stipules makes the travelling tip legible.
    for j,sign in enumerate((-1,1)):
        angle=degrees_of(d)+sign*(38+8*j)
        leaf(mesh,root+FRONT*1.1,angle,8+j*2,2.0,.84,1,3,sign*.5)

def degrees_of(d):
    from math import atan2, degrees
    return degrees(atan2(d.y,d.x))

# Fixed compositions. Entries are arc station, blade angle, blade length,
# pigment, and blade type (lobed or lanceolate).
FIRST_LEAVES=[
    (.055,-35,22,1,1),(.14,165,30,4,0),(.21,-72,33,0,0),
    (.31,202,32,2,0),(.405,-19,44,0,0),(.50,208,38,4,0),
    (.575,-5,32,1,1),(.68,223,37,0,0),(.755,24,35,2,0),
    (.836,251,28,1,0),(.925,-40,22,3,1)]
ARCH_LEAVES=[
    (.049,-67,27,1,1),(.125,190,27,4,0),(.200,-44,31,0,0),
    (.276,205,29,2,0),(.354,-26,35,1,0),(.422,221,30,0,0),
    (.516,28,28,4,0),(.59,246,31,2,0),(.674,67,27,0,0),
    (.752,268,26,1,1),(.837,51,22,2,1),(.923,-48,18,3,1)]
GATE_LEAVES=[
    (.042,-64,29,1,1),(.117,178,28,2,1),(.194,-30,32,0,0),
    (.268,212,36,0,0),(.347,-30,31,1,1),(.425,209,29,2,0),
    (.502,23,29,4,0),(.57,242,35,0,0),(.642,37,23,1,1),
    (.723,254,30,2,1),(.801,327,23,1,1),(.888,265,21,4,1)]

def runner(mesh,trail,progress,leaves,radius,mirror,scrolls,coil,braid):
    stem(mesh,trail,progress,radius,TWIG if trail in (FIRST,ARCH_RIGHT) else BARK,braid)
    for i,(station,angle,size,pigment,kind) in enumerate(leaves):
        if mirror:
            angle=178-angle+(i%3-1)*9
            pigment=[2,4,0,3,1][pigment]
            size*=.94+(i%3)*.04
        leaf_at(mesh,trail,progress,station,angle,size,pigment,kind,(-1 if i%2 else 1)*.7)
    for station,angle,length,radius,hand in scrolls:
        scroll_at(mesh,trail,progress,station,180-angle if mirror else angle,length,radius,
                  -hand if mirror else hand)
    terminal(mesh,trail,progress,coil,-1 if mirror else 1)

def side_spray(mesh,trail,progress,station,angle,length,hand):
    age=eased(station+.012,station+.21,progress)
    if age<.015: return
    root=trail.at(station)+FRONT*1.3
    axis=direction(angle); side=left(axis)*hand
    a=root+axis*(length*.34)+side*(length*.25)
    end=root+axis*length+side*(length*.04)+FRONT*2
    b=end-axis*(length*.30)+side*(length*.24)
    mesh.pipe([bezier(root,a,b,end,age*i/14) for i in range(15)],
              lambda t:1.3-.72*t*age,wood(TWIG),7)
    for i,(q,delta,scale,pigment) in enumerate(((.32,59,.57,2),(.56,-53,.49,4),(.83,5,.46,1))):
        leaf(mesh,bezier(root,a,b,end,q)+FRONT*.7,angle+hand*delta,
             length*scale,length*scale*.30,eased(q-.03,q+.20,age),1,pigment,.6*(-1)**i)

def basal_pair(mesh,trail,growth,mirror):
    age=eased(.026,.16,growth)
    root=trail.at(.026)+FRONT*1.3
    for deg,size,pig in ((-41,16,3),(48,12,4)):
        leaf(mesh,root,180-deg if mirror else deg,size,size*.26,age,1,pig,.35)


FLOWER = [tuple(map(ink,row)) for row in (
    ("51395f","9a72af","dcc1e4","f2dbdd"),
    ("53436f","8676b8","c4b7e6","e4dcf0"),
    ("64435e","b782a6","e2b8cc","f1d3d1"))]

def floret(mesh,base,size,facing,opened,palette):
    """A pea corolla has a broad notched banner, two wings and a cupped keel."""
    if size<.5: return
    shadow,mid,light,cream=FLOWER[palette]
    axis=direction(facing); across=left(axis)
    def petal(t,s,form):
        spread=(.30+.70*opened)
        if form==0:
            w=.85*sin(pi*t*.84)**.69
            distance=(1.13-.23*abs(s)**3-.15*exp(-(s/.19)**2))*t
            # The banner turns back above the throat.
            p=base+size*(axis*distance+across*(w*s*spread)+
                         FRONT*(.09+.12*sin(pi*t)+.09*t*s*s))
            col=blend(mid,cream,clamp(.17+.74*t-.22*abs(s)+.05*cos(8*s)))
        else:
            side=-1 if form==1 else 1 if form==2 else 0
            w=(.32 if side else .28)*sin(t*pi)**.55
            distance=(.19*t if side else -.61*t)
            bend=(.58+.16*t)*sin(pi*t*.60)*side if side else .08*sin(pi*t)
            p=base+size*(axis*distance+across*((bend+w*s)*spread)+
                         FRONT*((.12 if side else .30)+.23*sin(pi*t)))
            col=blend(shadow,light if side else mid,clamp(.25+.5*t-.24*s*side))
        return p,col
    for form in (0,1,2,3):
        mesh.skin(6,8,lambda t,s:petal(t,s,form))
    if size>3 and opened>.3:
        mesh.mark(lambda t:petal(.21+.26*t,.12*t,0)[0]+FRONT*.32,
                  lambda t:size*.075*(1-.7*t),GOLD,3)

def wisteria(mesh,base,length,radius,age,lean,phase,palette,rows):
    if age<.012: return
    def axis(t):
        return base+V((lean*t*t+4.2*sin(t*pi+phase)*sin(t*pi),
                       length*t,2.0*sin(t*pi)+t*3))
    grow=eased(0,.66,age)
    mesh.pipe([axis(i*grow/24) for i in range(25)],
              lambda t:1.04-.72*t*grow,wood(TWIG),7)
    for i in range(rows):
        t=(i+.7)/(rows+.5)
        opening=eased(.10+.54*t,.46+.54*t,age)
        if opening<.02: continue
        azi=phase+2.40*i
        spread=(.30+.70*opening)*radius*(1-.68*t)
        side=cos(azi)
        node=axis(t)
        pedicel=V((side*spread*.86,2.0+spread*.33,spread*.31*sin(azi)+1.1))
        end=node+pedicel*opening
        mesh.pipe([node,node+.54*pedicel*opening+V((0,-1,0)),end],
                  lambda q:.77-.33*q,wood(TWIG),5)
        # Distinct descending whorls carry smaller and duskier blossoms below.
        facing=251+side*49+9*sin(azi)
        floret(mesh,end,radius*(.69-.37*t)*(.10+.90*opening),facing,
               opening,palette if i%7 else (palette+1)%3)
    # The last three closed buds make the tip read as a taper even at 1x.
    for i in range(3):
        o=eased(.56+i*.055,.85+i*.055,age)
        if o:
            p=axis(.93+i*.04)+V(((-1)**i*1.65,0,1))
            floret(mesh,p,2.3*o,94+(-1)**i*25,.10,palette)

def pendants(mesh,trail,growth,frame,specs):
    for station,length,width,lean,phase,palette,rows,birth in specs:
        if station>growth: continue
        age=eased(birth,birth+23,frame)
        sway=sin((frame-birth)*.26+phase)*2.4*(1-eased(birth+13,birth+29,frame))
        wisteria(mesh,trail.at(station)+FRONT*3.6,length,width,age,lean+sway,phase,palette,rows)

def coronet(mesh,frame):
    # A late three-leaf palmette and paired outward volutes above the keystone.
    root=V((240,49,13))
    age=eased(56,80,frame)
    if age<.03: return
    for sign in (-1,1):
        d=V((sign*.72,-.69,0))
        end=root+d*(14*age)+FRONT*1.2
        mesh.pipe([root,end],lambda t:age*(1.55-.55*t),wood(COPPER),7)
        spiral(mesh,end,d,7.7,sign,1.18,eased(.24,1,age),1.18,COPPER)
    for angle,length,pig,birth in ((-135,21,1,61),(-43,20,1,64),(-92,32,3,66)):
        leaf(mesh,root+FRONT*2,angle,length,5.6,eased(birth,80,frame),1,pig,.34)

def scene_at(level,frame):
    mesh=Clay()
    frame=min(frame,COUNTS[level]-7)
    if level==1:
        g=.018+.982*eased(1,60,frame)
        runner(mesh,FIRST,g,FIRST_LEAVES,3.9,False,
               ((.27,257,19,8,-1),(.505,-40,28,11,1),(.77,209,22,9.2,-1)),14,2.75)
        basal_pair(mesh,FIRST,g,False)
        side_spray(mesh,FIRST,g,.32,-59,32,1)
        side_spray(mesh,FIRST,g,.67,-20,31,-1)
        # A final copper leaflet opens at the crest after the runner arrives.
        if frame>=54:
            leaf(mesh,FIRST.at(.97)+FRONT*2,-64,24,7.8,eased(54,65,frame),1,3,-.5)
    elif level==2:
        lg=.014+.986*eased(1,60,frame)
        rg=.013+.987*eased(6,68,frame)
        runner(mesh,ARCH_LEFT,lg,ARCH_LEAVES,4.05,False,
               ((.22,-21,17,8.5,1),(.485,196,22,9,-1),(.70,31,16,7,1)),10,4.4)
        runner(mesh,ARCH_RIGHT,rg,ARCH_LEAVES,3.55,True,
               ((.34,-15,17,8.8,-1),(.55,252,16,8,1),(.74,44,19,7,-1)),10.5,3.65)
        for trail,growth,mirror in ((ARCH_LEFT,lg,False),(ARCH_RIGHT,rg,True)):
            basal_pair(mesh,trail,growth,mirror)
            side_spray(mesh,trail,growth,.30,-146 if mirror else -39,32,-1 if mirror else 1)
            side_spray(mesh,trail,growth,.60,103 if mirror else 66,23,1 if mirror else -1)
        leaf(mesh,ARCH_RIGHT.at(.969)+FRONT*2,234,17,4.8,eased(63,73,frame),1,1,.4)
    else:
        lg=.015+.985*eased(1,55,frame)
        rg=.012+.988*eased(4,60,frame)
        runner(mesh,GATE_LEFT,lg,GATE_LEAVES,5.15,False,
               ((.20,-14,26,11,1),(.38,207,23,12,-1),(.64,-77,15,8,1)),9.5,4.75)
        runner(mesh,GATE_RIGHT,rg,GATE_LEAVES,4.85,True,
               ((.218,-14,26,10.5,1),(.41,209,19,10,-1),(.635,-85,16,8,1)),9,4.30)
        for trail,growth,mirror in ((GATE_LEFT,lg,False),(GATE_RIGHT,rg,True)):
            basal_pair(mesh,trail,growth,mirror)
            side_spray(mesh,trail,growth,.119,260 if mirror else -78,30,1 if mirror else -1)
            side_spray(mesh,trail,growth,.33,-170 if mirror else -11,24,-1 if mirror else 1)
            side_spray(mesh,trail,growth,.69,235 if mirror else -47,26,1 if mirror else -1)
        pendants(mesh,GATE_LEFT,lg,frame,[
            (.515,68,11.5,5,.48,1,16,29),(.715,56,12,5,1.9,0,14,41),
            (.85,34,8,-2,.82,2,10,49)])
        pendants(mesh,GATE_RIGHT,rg,frame,[
            (.505,65,12.5,-6,2.1,0,16,36),(.665,73,12,-6,.2,1,17,42),
            (.805,44,9.6,1,1.1,2,12,52)])
        coronet(mesh,frame)
    return mesh

def studio():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=10
    scene.cycles.use_denoising=False
    scene.cycles.use_adaptive_sampling=False
    scene.cycles.use_animated_seed=False
    scene.cycles.max_bounces=1
    scene.render.threads_mode="FIXED"
    scene.render.threads=4
    scene.render.fps=24
    scene.render.resolution_x=480
    scene.render.resolution_y=360
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="8"
    scene.render.image_settings.compression=25
    scene.render.film_transparent=True
    scene.render.use_persistent_data=True
    scene.view_settings.view_transform="Standard"
    camera=bpy.data.cameras.new("Fixed 4:3 rostrum")
    camera.type="ORTHO"; camera.ortho_scale=480; camera.clip_end=1500
    view=bpy.data.objects.new("Front",camera); scene.collection.objects.link(view)
    view.location=(240,-180,600); scene.camera=view
    # An oblique sun gives actual depth cues at crossings; emission keeps the
    # painted underside luminous enough to use over a dark game board.
    light=bpy.data.lights.new("Raking softbox","SUN")
    light.energy=2.25; light.angle=radians(18)
    lamp=bpy.data.objects.new("Upper left",light); scene.collection.objects.link(lamp)
    lamp.rotation_euler=V((.32,-.39,-.87)).to_track_quat("-Z","Y").to_euler()
    mat=bpy.data.materials.new("Woodland • painted silk and bark")
    mat.use_nodes=True; tree=mat.node_tree; tree.nodes.clear()
    node=tree.nodes.new; connect=tree.links.new
    col=node("ShaderNodeVertexColor"); col.layer_name="Gouache"
    diffuse=node("ShaderNodeBsdfDiffuse"); connect(col.outputs[0],diffuse.inputs[0])
    emission=node("ShaderNodeEmission"); connect(col.outputs[0],emission.inputs[0])
    emission.inputs["Strength"].default_value=1.12
    mix=node("ShaderNodeMixShader"); mix.inputs[0].default_value=.71
    connect(diffuse.outputs[0],mix.inputs[1]); connect(emission.outputs[0],mix.inputs[2])
    final=node("ShaderNodeOutputMaterial"); connect(mix.outputs[0],final.inputs["Surface"])
    return scene,mat

def render(level,frames):
    scene,mat=studio()
    count=COUNTS[level]; scene.frame_end=count
    out=ROOT/"assets/videos/woodland"/f"vines-{level}"
    out.mkdir(parents=True,exist_ok=True)
    plant=None
    for f in frames or range(1,count+1):
        if not 1<=f<=count: raise ValueError(f)
        file=out/f"{f:03}.png"
        if not frames and f>count-7:
            shutil.copyfile(out/f"{count-7:03}.png",file)
            continue
        data=scene_at(level,f).bake(mat)
        if plant is None:
            plant=bpy.data.objects.new("Climbing vine",data)
            scene.collection.objects.link(plant)
        else:
            old=plant.data; plant.data=data; bpy.data.meshes.remove(old)
        scene.frame_set(f); scene.render.filepath=str(file)
        bpy.ops.render.render(write_still=True)
        print(f"Vines {level}: {f:03}/{count}",flush=True)

if __name__=="__main__":
    args=list(map(int,sys.argv[sys.argv.index("--")+1:]))
    render(args[0],args[1:])
