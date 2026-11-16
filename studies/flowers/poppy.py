"""Scarlet poppies • three animated herbarium studies, drawn as Blender meshes.

In word-woods:
  blender -b -t 5 -P studies/flowers/poppy.py -- 1 [one-based frames ...]
  python studies/flowers/poppy.py pack 1 2 3
  python studies/flowers/poppy.py check 1 2 3
  python studies/flowers/poppy.py proof 1 2 3

No external artwork. The same function evaluates each frame independently, so a
selected still or a broken render can be regenerated without baking a simulation.
"""
import sys
from pathlib import Path
from math import sin, cos, pi, sqrt, exp, radians, atan2
import random

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/flower-studies"
OUT = ROOT / "dist/assets/flower-studies"
COUNTS = {1:72, 2:84, 3:96}
BEST = {1:65, 2:77, 3:83}
BEATS = {1:((1,"Seed"),(33,"Nodding bud"),(65,"Open disc")),
         2:((1,"Seed"),(49,"First cup"),(77,"Fork in bloom")),
         3:((1,"Seed"),(63,"Crest opens"),(89,"Meadow hold"))}
TAU = 2*pi


def finish(action, levels):
    import json
    import runpy
    from PIL import Image, ImageChops, ImageDraw
    pack = runpy.run_path(str(ROOT / "studies/ember-orca/pack-progression.py"))["pack_shot"]
    for level in levels:
        stem = f"poppy-{level}"
        folder = RAW / stem
        if action == "pack":
            OUT.mkdir(parents=True, exist_ok=True)
            pack(folder, OUT, stem, COUNTS[level])
            import shutil
            still = BEST[level]
            shutil.copyfile(folder / f"{still:03}.png", OUT / (stem+"-poster.png"))
        manifest = json.loads((OUT / (stem+".json")).read_text())
        assert len(manifest["frames"]) == COUNTS[level]
        sheets = [Image.open(OUT / fn).convert("RGBA") for fn in manifest["sheets"]]
        margins = [480, 360, 480, 360]
        changes = 0
        last = None
        first_hold = None
        playback = []
        for i, frame in enumerate(manifest["frames"], 1):
            with Image.open(folder / f"{i:03}.png") as im:
                assert im.mode == "RGBA" and im.size == (480,360)
                a = im.getchannel("A")
                box = a.getbbox()
                page, x, y, w, h, l, t = frame
                assert box == (l,t,l+w,t+h)
                cropped = sheets[page].getchannel("A").crop((x,y,x+w,y+h))
                assert not ImageChops.difference(a.crop(box), cropped).getbbox()
                if action=="proof":
                    tile = Image.new("RGBA", (480,360), "#f9f4e9")
                    tile.alpha_composite(sheets[page].crop((x,y,x+w,y+h)),(l,t))
                    playback.append(tile.convert("RGB"))
                margins = list(map(min,margins,[l,t,480-l-w,360-t-h]))
                if last is not None and ImageChops.difference(a,last).getbbox():
                    changes += 1
                last = a
                if i == COUNTS[level]-4:
                    first_hold = im.copy()
                if i == COUNTS[level]:
                    assert im.tobytes() == first_hold.tobytes(), "Final bloom must hold"
        assert min(margins) >= 8 and changes >= COUNTS[level]*.72
        if playback:
            # Playback proofs are reconstructed from shipping atlas coordinates.
            # Use cumulative times to compensate for integer-millisecond delays.
            timing=[round(1000*(i+1)/24)-round(1000*i/24) for i in range(len(playback))]
            playback[0].save(folder/(stem+"-playback.webp"),save_all=True,
                             append_images=playback[1:],duration=timing,loop=0,quality=92,method=3)
            beats=Image.new("RGB",(480*3,294),"#f9f4e9")
            draw=ImageDraw.Draw(beats)
            for j,(num,caption) in enumerate(BEATS[level]):
                beats.paste(playback[num-1].crop((0,77,480,355)),(480*j,16))
                draw.text((480*j+18,12),f"{num:03}   /   {caption}",fill="#695c49")
            beats.save(folder/(stem+"-beats.jpg"),quality=95)
        print(stem, "frames", len(manifest["frames"]), "sheets", len(sheets),
              "alpha margins L/T/R/B", margins, "silhouette changes", changes, flush=True)
    if action=="proof" and set(levels)==set(COUNTS):
        from PIL import ImageFont
        def face(name,size):
            try: return ImageFont.truetype(name,size)
            except OSError: return ImageFont.load_default(size=size)
        plate=Image.new("RGBA",(1000,370),"#f9f4e9")
        d=ImageDraw.Draw(plate)
        d.text((25,16),"Scarlet poppies",font=face("georgia.ttf",26),fill="#412d32")
        d.text((974,27),"PAPAVER    /    FLOWER STUDIES",anchor="ra",
               font=face("arial.ttf",12),fill="#766b56")
        d.line((25,55,975,55),fill="#cfc4ae")
        for level,(cx,title) in enumerate([(127,"I.  The lifted bud"),(394,"II.  Counterpoint"),
                                           (754,"III.  The scarlet wave")],1):
            with Image.open(OUT/f"poppy-{level}-poster.png") as im:
                box=im.getchannel("A").getbbox()
                plate.alpha_composite(im.crop(box),(cx+box[0]-240,box[1]-20))
            d.text((cx,340),title,font=face("georgiai.ttf",16),anchor="ma",fill="#574a41")
        plate.convert("RGB").save(RAW/"poppy-3/poppy-family.jpg",quality=96)


if __name__ == "__main__" and "--" not in sys.argv:
    if len(sys.argv)<2 or sys.argv[1] not in ("pack","check","proof"):
        raise SystemExit(__doc__)
    finish(sys.argv[1], list(map(int,sys.argv[2:])) or list(COUNTS))
    raise SystemExit

import bpy
from mathutils import Vector

V = Vector
X,Y,Z = (V(q) for q in [(1,0,0),(0,1,0),(0,0,1)])
def clamp(x): return max(0,min(1,x))
def ease(a,b,x):
    t = clamp((x-a)/(b-a))
    return t*t*(3-2*t)
def lerp(a,b,u): return a+(b-a)*u
def hexcol(s): return tuple(int(s[i:i+2],16)/255 for i in (0,2,4))
def mix(a,b,u): return tuple(x+(y-x)*u for x,y in zip(a,b))
def tone(a,k): return tuple(clamp(x*k) for x in a)

MOSS,OLIVE,SAGE,LIME,STRAW,VEIN,INK,POLLEN = map(hexcol,
    ("435944","788657","9cab78","b6bd80","cfb779","566a4d","342c39","e4b56e"))
# Three pools per pigment: wet-in-wet foot, body colour, dry luminous edge.
PALETTES = [tuple(map(hexcol,row)) for row in (
    ("812132","dc382e","ff9a76"), ("a62b35","f15b36","ffa879"),
    ("79223e","cc3946","f39482"), ("a53523","ec6530","ffb16c"),
    ("a44b4d","e97a64","ffaf8e"))]

class Drawing:
    def __init__(self):
        self.pts,self.faces,self.col,self.grain = [],[],[],[]
    def point(self,p,c,uv=None):
        self.pts.append(tuple(p))
        self.col.extend((*c,1))
        self.grain.extend(uv if uv is not None else (p[0],p[1],p[2]))
    def grid(self,n,m,fn):
        base=len(self.pts)
        for i in range(n+1):
            for j in range(m+1):
                self.point(*fn(i/n,2*j/m-1))
        for i in range(n):
            k=base+i*(m+1)
            for j in range(m):
                a=k+j
                self.faces.append((a,a+m+1,a+m+2,a+1))
    def stroke(self,path,width,col,steps=14):
        """Ink-wash ribbon; taper and varying pressure live in width(t)."""
        pts=[V(path(i/steps)) for i in range(steps+1)]
        base=len(self.pts)
        for i,p in enumerate(pts):
            t=i/steps
            d=pts[min(steps,i+1)]-pts[max(0,i-1)]
            side=V((-d.y,d.x,0)).normalized()*width(t)
            for s in (-1,1): self.point(p+side*s,col(t,s) if callable(col) else col)
            if i:
                k=base+2*i; self.faces.append((k-2,k,k+1,k-1))
    def oval(self,center,u,v,depth,color,n=16):
        # Painted cabochons, with a real raised crown and a soft wet perimeter.
        base=len(self.pts)
        for r in (.02,.53,.86,1):
            for j in range(n):
                a=TAU*j/n; px=cos(a)*r; py=sin(a)*r
                self.point(center+u*px+v*py+Z*(depth*(1-r*r)),
                           tone(color,1.03+.11*py-.07*px-.18*r*r))
        self.faces.append(tuple(range(base,base+n)))
        for i in range(3):
            for j in range(n):
                a=base+i*n+j; b=base+i*n+(j+1)%n
                self.faces.append((a,a+n,b+n,b))
    def mesh(self):
        mesh=bpy.data.meshes.new("Pigment, ribs and calyces")
        mesh.from_pydata(self.pts,[],self.faces)
        color=mesh.color_attributes.new(name="Pigment",type="BYTE_COLOR",domain="POINT")
        color.data.foreach_set("color_srgb",self.col)
        grain=mesh.attributes.new(name="Paper",type="FLOAT_VECTOR",domain="POINT")
        grain.data.foreach_set("vector",self.grain)
        mesh.materials.append(mat)
        mesh.update()
        return mesh

def cubic(a,b,c,d,t):
    s=1-t
    return a*(s*s*s)+b*(3*s*s*t)+c*(3*s*t*t)+d*(t*t*t)

def leaf(D,root,dx,dy,width,age,lobed=True,shade=0):
    if age<.008: return
    u=V((dx,dy,0)); norm=V((-dy,dx,0)).normalized()
    def surface(t,s):
        belly=sin(pi*t)**(.68 if lobed else .57)
        notch=(.32+.68*abs(sin(pi*(3.3*t+.17*s)))**1.4) if lobed else 1
        # Pointed lobes lean forward on alternate sides of the midrib.
        pos=root+age*(u*(t+(.12*abs(s)*belly if lobed else 0))
                  +norm*(width*s*belly*notch+width*.37*sin(t*pi))
                  +Z*(1.1*belly*(1-abs(s))+.8*t))
        c=mix(MOSS if lobed else OLIVE, SAGE if not shade else LIME,
              clamp(.54-.22*s+.18*t+.06*sin(t*28+s*2)))
        return pos,c
    D.grid(36 if lobed else 12,8,surface)
    D.stroke(lambda t: surface(t,0)[0]+Z*.35,lambda t: age*(.58*(1-t)+.08),LIME,16)
    if lobed and width*age>3:
        for j in range(1,5):
            for side in (-1,1):
                D.stroke(lambda t: surface(j*.16+.11*t,side*t*.86)[0]+Z*.25,
                         lambda t: age*(.24-.16*t),VEIN,4)

def axis(tilt,yaw,roll):
    t,a,r=map(radians,(tilt,yaw,roll))
    n=V((cos(t)*sin(a),sin(t),cos(t)*cos(a)))
    u=V((cos(a),0,-sin(a))); v=n.cross(u)
    return u*cos(r)+v*sin(r), v*cos(r)-u*sin(r), n

def petal(D,origin,B,R,angle,opening,idx,palette,seed,drift=False):
    u,v,n=B
    rng=random.Random(seed)
    j=rng.random()*TAU; ratio=rng.uniform(.89,1.06)*(1.075 if idx==1 else .97)
    foot,body,lip=PALETTES[palette]
    body=mix(body,lip,.24 if idx==1 else (.08 if idx==2 else .0))
    def surf(t,s):
        # Fluted fan sewn into a narrow claw. Rim scallops affect shape and
        # pigment independently, preventing the painted line from reading as plastic.
        theta=angle+s*(.63+.47*sin(pi*t*.51))+.105*sin(t*3+j)
        scallop=.047*cos(13*s+j)+.021*sin(23*s-j)
        radial=(.047+.95*t)*ratio*(1-.24*abs(s)**3+scallop*t**3)
        pleat=sin(14*s+.85*sin(t*3+j)+j)+.42*sin(26*s-2.7*t+j)
        spread=.15+.85*opening
        rr=R*radial*spread
        curl=(.18 if idx in (0,3) else .085)*ease(.46,1,s)*t**1.4
        lift=R*((.035+.90*t)*(1-opening)+opening*(.030+.13*t+.20*t*t
                  +.12*s*s*t+.070*t*pleat+.052*cos(5*s+j)*t*t+curl))
        p=origin+u*(rr*cos(theta))+v*(rr*sin(theta))+n*lift
        # Pool a separate aubergine basal blotch into the scarlet silk.
        wash=ease(.07,.70,t)+.10*pleat+.08*sin(4*s+4*t+j)
        c=mix(foot,body,clamp(wash))
        c=mix(c,lip,clamp((.075+.35*t*t+.15*pleat+.17*cos(s*4-t*7+j))*(.65+.35*t)))
        c=mix(c,INK,(1-ease(.13,.36+.045*cos(7*s+j),t))*.85)
        c=tone(c,1-.11*abs(s)**5)
        return p,c,(s*R*.9,t*R,j)
    D.grid(17,36,surf)
    # Capillary tide line and two incomplete dry-brush marks on the outer rim.
    D.stroke(lambda q: surf(1,q*2-1)[0]+n*.18,lambda q: R*.005*(.42+sin(pi*q)),
             mix(body,foot,.35),34)
    for left,right in ((-.82,-.32),(.03,.48)):
        D.stroke(lambda q: surf(.979,lerp(left,right,q))[0]+n*.24,
                 lambda q: R*.006*(.13+sin(q*pi)),mix(lip,(1,.85,.70),.5),12)
    for i in range(9):
        s=-.87+i*.21+rng.uniform(-.035,.035)
        stop=rng.uniform(.68,.96)
        start=rng.uniform(.16,.31)
        D.stroke(lambda q: surf(lerp(start,stop,q),s+.055*sin(pi*q+j)*q)[0]+n*.34,
                 lambda q: R*.005*(.15+.86*sin(pi*q)**.5),
                 mix(body,foot,.47),13)

def eye(D,p,B,R,amount,seed):
    if amount<.015: return
    u,v,n=B; rng=random.Random(seed)
    p=p+n*(R*.15)
    R*=amount
    D.oval(p,u*.19*R,v*.18*R,.8,INK,24)
    for j in range(38):
        a=TAU*j/38+rng.uniform(-.06,.06)
        d=u*cos(a)+v*sin(a); side=-u*sin(a)+v*cos(a)
        length=R*rng.uniform(.165,.268)
        tip=p+d*length+n*rng.uniform(.9,2.8)
        D.stroke(lambda t:p+d*(R*.075+(length-R*.075)*t)+n*(1.2+1.8*t),
                 lambda t:R*.009*(1-.34*t),INK,4)
        c=mix(INK,POLLEN,rng.uniform(.05,.27) if j%5 else .82)
        D.oval(tip,d*(R*.035),side*(R*.019),.34,c,8)
    center=p+n*3.5
    D.oval(center,u*R*.105,v*R*.092,1.25,SAGE,16)
    for j in range(9):
        d=u*cos(j*TAU/9)+v*sin(j*TAU/9)
        D.stroke(lambda t:center+d*R*.084*t+n*1.65,lambda t:R*.0075,VEIN,2)

def sepals(D,p,B,R,open_,phase):
    u,v,n=B
    for sign in (-1,1):
        def shape(t,s):
            bulge=sin(pi*t)**.74
            outer=R*(.225+.022*t)*bulge
            side=sign*(outer*cos(s*pi/2)*(1-.55*open_)+R*.33*t*open_)
            length=lerp(.63,-.13,open_)*t
            pos=p+n*(R*length)+u*side+v*(sin(s*pi/2)*outer*(1-.4*open_))
            col=mix(MOSS,SAGE,clamp(.47+.20*s+.14*sin(t*4+phase)+.12*cos(8*s)))
            return pos,col
        D.grid(14,10,shape)
        D.stroke(lambda t:shape(t,.0)[0]+Z*.33,lambda t:R*.007*(.2+sin(t*pi)),LIME,12)
        for j in range(11):
            t=(j+1)/13
            q=shape(t,(-1)**j*.65)[0]
            D.stroke(lambda k:q+(u*(.9*sign)+n*.45)*k*R*.035,
                     lambda k:R*.0035*(1-.8*k),SAGE,2)

def head(D,p,R,tilt,yaw,roll,opening,budsize,palette,seed,budonly=False):
    if budsize<.01: return
    R*=budsize
    B=axis(tilt,yaw,roll)
    if not budonly and opening>.012:
        # The two pairs spring apart in succession and show different painted faces.
        for i,ang in enumerate((50,141,226,318)):
            k=ease(.0 if i<2 else .105,.9 if i<2 else 1,opening)
            petal(D,p+B[2]*(i*.14),B,R*(.23+.77*ease(.02,.8,opening)),
                  radians(ang),k,i,(palette+(1 if i==1 and palette==0 else 0))%5,
                  791*seed+i*177)
        eye(D,p,B,R,ease(.25,.88,opening),seed)
    sepals(D,p,B,R,ease(.02,.65,opening),seed)


def seedling(D,f,level):
    split=ease(4,16,f); emerge=ease(6,20,f)
    for side in (-1,1):
        root=V((side*(.2+5.1*split),3.4-.8*split,14))
        ang=radians(-23+side*split*48)
        u=V((cos(ang),sin(ang),0)); v=V((-sin(ang),cos(ang),0))
        def coat(t,s):
            across=(s+1)*.5; belly=sin(pi*t)**.59
            xx=side*8.1*belly*across+1.8*sin(t*4.2)
            yy=(t-.5)*13.4+across*.7
            p=root+u*xx+v*yy+Z*(1.6*belly*(1-across**2))
            c=mix(hexcol("634b42"),hexcol("c19870"),
                  clamp(.41+.27*t+.24*cos(across*2)+.08*sin(t*27-across*19)))
            c=mix(c,hexcol("ddba85"),(1-ease(.03,.21,across))*split*.8)
            return p,c
        D.grid(17,8,coat)
        for j in range(4):
            D.stroke(lambda t:coat(.15+.71*t,-.70+.43*j+.08*sin(t*8+j))[0]+Z*.24,
                     lambda t:.23*(.3+sin(pi*t)),hexcol("ad8261"),9)
    if emerge>.005:
        D.stroke(lambda t:V((1.8*sin(t*6)*emerge,(2+12*t)*emerge,15)),
                 lambda t:1.18-.35*t,SAGE,12)
    cot=ease(9,22,f)
    if cot:
        for s in (-1,1):
            leaf(D,V((0,8.5*emerge,15.8)),s*(15 if s>0 else 18),
                 8 if s>0 else 11,3.2,cot,False,s>0)

def grass(D,base,spread,height,count,age,seed,plumes):
    if age<.02: return
    rng=random.Random(seed)
    for j in range(count):
        dir_=(2*j/(count-1)-1)+rng.uniform(-.12,.12)
        r=base+V((dir_*7,abs(dir_)*.9,j*.085))
        dx=dir_*spread*rng.uniform(.74,1.04)
        dy=height*rng.uniform(.47,1.04)*(1-.39*abs(dir_))
        width=rng.uniform(.74,1.8)
        bend=rng.uniform(-.08,.16)*spread
        def blade(t):
            return r+age*V((dx*(.35*t+.65*t*t)+bend*sin(pi*t),
                              dy*(t+.25*sin(pi*t)),.6*t))
        def surface(t,s):
            wd=age*width*(.12+.88*sin((t*.86+.12)*pi)**.6)*(1-t**4)
            tangent=V((dx*(.35+1.30*t)+bend*pi*cos(pi*t),dy*(1+.25*pi*cos(pi*t)),0))
            side=V((-tangent.y,tangent.x,0)).normalized()
            return blade(t)+side*s*wd, mix(OLIVE if j%3 else MOSS,STRAW if j%4==1 else SAGE,
                                            clamp(.27+.27*t-.23*s))
        D.grid(15,2,surface)
        if plumes and j in plumes:
            # Sparse oat spikelets, opening into a miniature fan at the tip.
            for h in range(6):
                t=.65+.055*h
                pt=blade(t); side=(-1)**h
                d=V((side*2.6+dx*.034,2.8,0))
                D.oval(pt+d*age*.65, d*age*.77,V((-d.y,d.x,0)).normalized()*age*.78,
                       .2,STRAW if h%3 else OLIVE,8)
                D.stroke(lambda k: pt+d*age*(.9+.95*k),lambda k: .22*age*(1-.8*k),STRAW,2)

# tip x/y, depth, radius, tilt/yaw/roll, pigment, growth interval, opening
# interval, bending controls (horizontal), and whether the calyx stays closed.
# All lengths are camera pixels. Z changes painting order and physical head depth.
def branch(D,f,origin,cfg,seed,hold):
    x,y,z,R,tilt,yaw,roll,pal,g0,g1,o0,o1,arc,arc2,closed=cfg
    grow=ease(g0,g1,f)
    if grow<.001: return lambda q: origin
    g=ease(o0,o1,f) if not closed else 0.
    lift=ease(o0-8,o0+7,f) if not closed else .0
    # Nod is concentrated in the terminal internode rather than scaling the
    # whole plant. The profile bud remains pendant while the hero looks up.
    sway=(sin((f-g1)*.24)*exp(-max(0,f-g1)*.097)*ease(g1-5,g1+2,f)
          *(1-ease(hold-7,hold,f)))
    tip=V((x+sway*2.1,y,z))
    a=origin
    b=origin+V((arc,(y-origin.y)*.38,0))
    c=V((x+arc2,y-(y-origin.y)*.28,z))
    def along(q):
        t=q*grow
        bend=ease(.65,1,q)*grow*(1-lift)
        return cubic(a,b,c,tip,t)+V(((-1 if arc2<0 else 1)*bend*4,
                                     -bend*(16 if not closed else 9),0))
    thick=(1.55 if closed else 1.9)*(.76+.24*grow)
    D.stroke(along,lambda t:thick*(1-.50*t),
             lambda t,s:mix(MOSS,SAGE,clamp(.35+.38*s+.14*t)),32)
    # Alternate, divided leaves, with larger outlines near the basal rosette.
    for j,(q,side) in enumerate(((.22,-1),(.44,1),(.64,-1))):
        if closed and j>0: continue
        amount=ease(q*.81,q+.22,grow)
        if not amount: continue
        pt=along(min(1,q/grow))+Z*.6
        direction=side if x>=0 else -side
        size=R*(.61-j*.106)*(1 if not closed else .74)
        leaf(D,pt,direction*size,size*(.55+.12*j),size*.23,amount,True,j%2)
    cap=ease(.37,.86,grow)
    angle=lerp(-65,tilt,lift)+sway*1.9
    # Orient pendant buds slightly across the page to reveal the hooked neck.
    orientation=lerp(-49 if arc2<0 else 54,yaw,lift)
    top=along(1)
    if closed or lift<.975:
        hook=(1-lift)*cap
        side=-1 if arc2<0 else 1
        def neck(t):
            return top+V((side*11*t*hook,
                          (6*sin(pi*t)-3*t)*hook,1.4*t*hook))
        D.stroke(neck,lambda t:thick*(.55-.08*t),OLIVE,14)
        top=neck(1)
    head(D,top,R,angle,orientation,roll,g,cap,pal,seed,closed)
    return along

def stray(D,f,start,end,a,b,c,d,size,seed):
    if f<=start: return
    t=clamp((f-start)/(end-start))
    # Detached petals drift in independent arcs and settle into the foliage.
    p=cubic(*map(V,(a,b,c,d)),t)
    p+=X*(4*sin(TAU*t)*sin(pi*t))
    B=axis(31+37*sin(TAU*t),-25+47*sin(pi*t),-20+137*t)
    petal(D,p,B,size*ease(0,.14,t),radians(59+90*t),.82,1,1,seed,True)

def artwork(level,f):
    D=Drawing()
    hold=COUNTS[level]-7
    f=min(f,hold)
    seedling(D,f,level)
    base=V((0,3,0))
    if level==1:
        branch(D,f,base+V((3,0,-4)),(45,108,-9,31,0,0,-14,2,17,44,65,75,18,12,True),42,hold)
        branch(D,f,base,(-12,173,4,64,41,-11,-12,0,9,37,35,59,-20,17,False),19,hold)
        grass(D,V((-10,0,11)),39,34,11,ease(18,42,f),19,(2,))
    if level==2:
        # Both bloom stems arise from the same live fork.
        main=branch(D,f,base,(38,180,0,57,30,14,19,0,10,43,46,70,-11,-19,False),67,hold)
        fork=main(.35)+V((0,0,.4))
        branch(D,f,fork,(-53,126,8,49,59,-33,-23,3,19,44,32,56,-33,11,False),32,hold)
        grass(D,V((10,0,13)),47,43,14,ease(18,49,f),88,(3,9))
        leaf(D,V((1,8,11)),33,15,5.5,ease(22,42,f))
    if level==3:
        # Back row: tall left/centre crest, then the coral three-quarter cup.
        row=[
          (-153,99,-21,37,57,-22,21,4,16,43,30,50,-65,11,False),
          (-91,140,-12,49,37,-24,-19,0,15,45,36,56,-54,9,False),
          (28,166,-11,56,31,8,16,1,19,49,48,69,8,-18,False),
          (116,123,-14,44,55,21,3,2,23,57,56,76,46,-20,False),
          (166,81,-2,31,58,32,-21,3,28,62,63,82,72,-13,False),
          (-34,93,15,41,45,-9,25,3,18,48,44,65,-14,16,False)]
        for i,conf in enumerate(row):
            # Overlapping basal shoots: each begins at the seed and takes its
            # own arcing route out of the rosette before turning skyward.
            xx=conf[0]*.42; prog=ease(12,30+i,f)
            yy=(12,9,11,7,16,5)[i]
            def foot(t):
                return base+V((xx*prog*t,(yy*t*t+(i%3-1)*3*sin(pi*t))*prog,conf[2]*prog*t))
            if prog: D.stroke(foot,lambda t:1.45-.5*t,OLIVE,16)
            if i in (0,3,4) and prog:
                leaf(D,foot(.76)+Z,(-1 if i==0 else 1)*(16+i),8+i,3.5,
                     ease(21+i,42+i,f),False,i%2)
            branch(D,f,foot(1),conf,17+i*19,hold)
        branch(D,f,V((26,4,-6)),(69,81,-7,23,0,0,12,0,29,58,86,98,16,-13,True),142,hold)
        branch(D,f,V((-50,4,-8)),(-120,64,-8,23,0,0,-9,0,27,55,86,98,-29,10,True),143,hold)
        for x,spread,height,amt,seed in [(-42,52,34,13,27),(51,57,38,12,28),(-2,44,48,12,29)]:
            age=ease(19+seed%4,49+seed%5,f)
            grass(D,V((x*ease(12,35,f),1,19)),spread,height,amt,age,seed,(2,7))
        stray(D,f,53,86,(-94,149,29),(-132,206,30),(-169,146,27),(-186,74,27),18,791)
        stray(D,f,61,89,(53,172,28),(91,201,35),(168,202,30),(155,164,32),18,682)
        stray(D,f,67,89,(115,136,27),(163,151,33),(191,110,38),(191,67,33),13,541)
    return D

def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene
    sc.render.engine="CYCLES"
    sc.cycles.device="CPU"; sc.cycles.samples=5
    sc.cycles.use_denoising=False
    sc.cycles.use_adaptive_sampling=False
    sc.cycles.use_animated_seed=False
    sc.render.threads_mode="FIXED"; sc.render.threads=5
    sc.render.resolution_x=480; sc.render.resolution_y=360
    sc.render.resolution_percentage=100; sc.render.fps=24
    sc.render.film_transparent=True; sc.render.image_settings.file_format="PNG"
    sc.render.image_settings.color_mode="RGBA"; sc.render.image_settings.color_depth="8"
    sc.render.image_settings.compression=22
    sc.view_settings.view_transform="Standard"
    sc.render.use_persistent_data=True
    ca=bpy.data.cameras.new("Herbarium rostrum • fixed")
    ca.type="ORTHO"; ca.ortho_scale=480; ca.clip_end=2000
    camera=bpy.data.objects.new("Rostrum",ca); sc.collection.objects.link(camera)
    camera.location=(0,156,660); camera.rotation_euler=(0,0,0); sc.camera=camera
    # The film is empty. Paper tooth and granulation pigment only the mesh.
    material=bpy.data.materials.new("Watercolour • lake pigment on silk")
    material.use_nodes=True
    tree=material.node_tree; tree.nodes.clear()
    node=tree.nodes.new; link=tree.links.new
    paint=node("ShaderNodeVertexColor"); paint.layer_name="Pigment"
    paper=node("ShaderNodeAttribute"); paper.attribute_name="Paper"
    grain=node("ShaderNodeTexNoise"); grain.inputs["Scale"].default_value=.85
    grain.inputs["Detail"].default_value=2.7
    link(paper.outputs["Vector"],grain.inputs["Vector"])
    pool=node("ShaderNodeTexNoise"); pool.inputs["Scale"].default_value=.11
    pool.inputs["Detail"].default_value=3.1
    link(paper.outputs["Vector"],pool.inputs["Vector"])
    grainmix=node("ShaderNodeMath"); grainmix.operation="ADD"
    link(pool.outputs["Fac"],grainmix.inputs[0]); link(grain.outputs["Fac"],grainmix.inputs[1])
    light=node("ShaderNodeMath"); light.operation="MULTIPLY_ADD"
    light.inputs[1].default_value=.43; light.inputs[2].default_value=.58
    link(grainmix.outputs[0],light.inputs[0])
    glow=node("ShaderNodeEmission"); link(paint.outputs[0],glow.inputs[0]); link(light.outputs[0],glow.inputs[1])
    output=node("ShaderNodeOutputMaterial"); link(glow.outputs[0],output.inputs[0])
    return sc,material

if __name__=="__main__":
    args=list(map(int,sys.argv[sys.argv.index("--")+1:]))
    level=args[0]; count=COUNTS[level]
    scene,mat=setup()
    scene.frame_start=1; scene.frame_end=count
    out=RAW/f"poppy-{level}"; out.mkdir(parents=True,exist_ok=True)
    ob=None
    import shutil
    for frame in args[1:] or range(1,count+1):
        if not 1<=frame<=count: raise ValueError(frame)
        filename=out/f"{frame:03}.png"
        # Repeated exposures of the final pose are bit-identical.
        held=out/f"{count-7:03}.png"
        if frame>count-7 and held.exists() and not args[1:]:
            shutil.copyfile(held,filename)
            continue
        mesh=artwork(level,frame).mesh()
        if ob is None:
            ob=bpy.data.objects.new("Papaver • pressed specimen",mesh)
            scene.collection.objects.link(ob)
        else:
            prev=ob.data; ob.data=mesh; bpy.data.meshes.remove(prev)
        scene.frame_set(frame)
        scene.render.filepath=str(filename)
        bpy.ops.render.render(write_still=True)
        print(f"POPPY {level} exposure {frame:03}/{count}",flush=True)

