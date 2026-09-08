"""原创程序器械：依据动作关节目标生成器械与动态部件。"""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector as V, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'muscle-preview'))
import build_scenes as S

class Equipment:
    def __init__(self,spec,first):
        self.spec=spec; self.objects=[]; self.dynamic=[]; self.tools={}
        self.metal=S.material('Equipment / satin steel',(.29,.35,.37),.35,.7)
        self.rubber=S.material('Equipment / charcoal rubber',(.027,.042,.048),.58,.1)
        self.pad=S.material('Equipment / muted green upholstery',(.095,.19,.165),.72)
        self.accent=S.material('Equipment / mint trim',(.13,.34,.25),.47,.3)
        self.line=S.material('Equipment / cable',(.04,.055,.063),.65,.35)
        a=spec['apparatus']; f=spec['family']; v=spec['variant']; sup=first['support']
        if 'bench' in sup:
            hip=V(sup['bench']['hip']); direction=Quaternion(V((1,0,0)),sup['bench']['pitch'])@V((0,0,1))
            center=hip+direction*.27-V((0,0,.10))
            pad=self.box('Incline back pad' if v=='incline' else 'Bench pad',center,(.30,1.12,.10),self.pad)
            pad.rotation_quaternion=V((0,1,0)).rotation_difference(direction)
            self.box('Bench seat',hip-V((0,.07,.105)),(.34,.33,.10),self.pad)
            for along in [-.12,.63]:
                end=hip+direction*along-V((0,0,.15))
                self.rod('Bench leg',(0,end.y,.05),end,.035)
                self.rod('Bench foot',(-.3,end.y,.025),(.3,end.y,.025),.025)
        elif sup.get('lying_bench'):
            self.box('Prone bench',(0,.20,.52),(.36,1.65,.10),self.pad)
            for y in [-.4,.75]:
                self.rod('Prone bench support',(0,y,.04),(0,y,.49),.035)
                self.box('Bench foot',(0,y,.025),(.45,.16,.05),self.rubber,.008)
        elif sup.get('hip_bench'):
            self.box('Hip thrust bench',(0,.56,.40),(.95,.42,.12),self.pad)
            for x in [-.36,.36]:
                self.rod('Hip bench leg',(x,.56,.04),(x,.56,.34),.032)
                self.box('Hip bench foot',(x,.56,.025),(.13,.16,.05),self.rubber,.008)
        elif sup.get('single_bench'):
            self.box('Single-arm row bench',(-.24,.12,.45),(.35,1.30,.10),self.pad)
            for y in [-.4,.64]:
                self.rod('Bench support',(-.24,y,.04),(-.24,y,.40),.035)
                self.box('Bench foot',(-.24,y,.025),(.45,.16,.05),self.rubber,.008)
        elif 'seat' in sup:
            self.box('Machine seat',sup['seat'],(.38,.42,.095),self.pad)
            self.rod('Seat post',(0,.12,.04),(0,.12,.435),.042)
            self.rod('Seat base',(-.30,.12,.035),(.30,.12,.035),.035)
            if f not in ['row','pulldown'] and v!='preacher':
                back=self.box('Seat backrest',(0,0 if v=='pec-reverse' else .245,.83),(.34,.075,.59),self.pad)
                back.rotation_quaternion=Quaternion(V((1,0,0)),first['pitch'])
        if a in ['mat']:
            self.box('Exercise mat',(0,.2,.009),(.88,2.18,.018),S.material('Mat / desaturated sage',(.25,.34,.31),.9),.01)
        if a in ['barbell','smith','hip-barbell','hip-smith','preacher-bar']:
            root=bpy.data.objects.new('Barbell controller',None); bpy.context.collection.objects.link(root); self.objects.append(root)
            length=1.76 if a!='preacher-bar' else 1.02
            parts=[self.cyl('Barbell shaft',.014,length,(0,0,0),self.metal)]
            for sign in [-1,1]:
                x=sign*(length*.43)
                for r,offset,depth in [(.225 if f=='hinge' and v in ['deadlift','sumo'] else .18,0,.055),(.14,sign*.045,.027)]: parts.append(self.cyl('Barbell plate',r,depth,(x+offset,0,0),self.rubber))
                parts.append(self.cyl('Barbell collar',.028,.03,(x-sign*.05,0,0),self.accent))
            for obj in parts: obj.parent=root
            self.tools['bar']=root
        if a in ['dumbbells','dumbbell-bench','goblet','single-dumbbell']:
            sides=['L'] if a in ['dumbbell-bench','goblet','single-dumbbell'] else ['L','R']
            for side in sides:
                root=bpy.data.objects.new('Dumbbell '+side,None); bpy.context.collection.objects.link(root); self.objects.append(root)
                parts=[self.cyl('Dumbbell grip',.016,.18,(0,0,0),self.metal)]
                for sign in [-1,1]:
                    parts+=[self.cyl('Dumbbell plate',.08,.048,(sign*.095,0,0),self.rubber),self.cyl('Dumbbell trim',.033,.005,(sign*.121,0,0),self.accent)]
                for obj in parts: obj.parent=root
                self.tools[side]=root
        if a in ['smith','hip-smith']:
            rail_y=(first['joints']['L']['grip'].y+first['joints']['R']['grip'].y)/2
            for x in [-.70,.70]:
                self.rod('Smith rail',(x,rail_y,.06),(x,rail_y,2.10),.017,self.metal)
                self.rod('Smith outer support',(x,rail_y+.11,.04),(x,rail_y+.11,2.13),.035)
                self.rod('Smith base',(x,rail_y-.5,.035),(x,rail_y+.55,.035),.035)
            self.rod('Smith upper crossbar',(-.70,rail_y+.11,2.10),(.70,rail_y+.11,2.10),.035)
        if a in ['lat-machine','lever-lat','high-cable','low-cable','dual-cable','row-cable']:
            dual=a=='dual-cable'; offset=a in ['low-cable','high-cable']
            xs=[-.76,.76] if dual else [-.60] if offset else [0]
            y=.75 if v=='overhead-cable' else -.8 if f not in ['pulldown'] else -.47
            for x in xs:
                for dx in [-.14,.14]: self.rod('Cable upright',(x+dx,y,.04),(x+dx,y,2.12),.026)
                for j in range(7): self.box('Weight stack',(x,y,.15+j*.044),(.30,.18,.035),self.rubber,.006)
                self.cyl('Pulley',.068,.04,(x,y,2.01 if a!='low-cable' else .10),self.rubber)
                self.rod('Tower foot',(x-.25,y,.035),(x+.25,y,.035),.032)
            if offset:
                level=.12 if a=='low-cable' else 2.02
                self.rod('Offset pulley beam',(-.60,y,level),(0,y,level),.025)
            if f=='pulldown':
                self.cyl('Thigh restraint',.055,.60,(0,-.18,.69),self.pad)
                self.rod('Thigh restraint support',(0,-.40,.05),(0,-.40,.68),.032)
            if dual:
                for side,sign in [('L',1),('R',-1)]: self.make_handle(side); self.dynamic.append(('cable',self.rod('Cable '+side,(0,0,0),(0,0,1),.003,self.line),(sign*.76,y,1.56),side))
            else:
                if f=='face_pull' or v in ['rope','overhead-cable','cable-crunch']:
                    for side in ['L','R']:
                        self.tools['rope_'+side]=self.rod('Rope branch '+side,(0,0,0),(0,0,1),.009,self.line)
                        self.tools['rope_end_'+side]=self.cyl('Rope end '+side,.024,.035,(0,0,0),self.rubber)
                    self.tools['rope_join']=self.cyl('Rope coupling',.018,.04,(0,0,0),self.metal)
                elif v=='vbar':
                    for side in ['L','R']: self.tools['vbar_'+side]=self.rod('V bar '+side,(0,0,0),(0,0,1),.014,self.metal)
                else:
                    self.tools['handle']=self.cyl('Cable bar',.013,1,(0,0,0),self.metal)
                    self.tools['handle']['adjust_length']=True
                self.dynamic.append(('cable',self.rod('Cable',(0,0,0),(0,0,1),.003,self.line),(0,y,.12 if a=='low-cable' else .45 if a=='row-cable' else 2.02),None))
        if a in ['pullup-bar','assisted-pullup','dip-bars']:
            wide=.67 if a!='dip-bars' else .44
            for sign in [-1,1]:
                self.rod('Frame tower',(sign*wide,.08,.035),(sign*wide,.08,2.24 if a!='dip-bars' else 1.03),.034)
                self.rod('Frame foot',(sign*wide,-.32,.035),(sign*wide,.54,.035),.038)
            if a!='dip-bars': self.rod('Pull-up grip',(-.67,-.04,2.148),(.67,-.04,2.148),.014,self.metal)
            else:
                for sign in [-1,1]: self.rod('Dip grip',(sign*.31,-.24,.95),(sign*.31,.35,.95),.018,self.metal)
            if a=='assisted-pullup':
                self.tools['knee_pad']=self.box('Assistance knee platform',(0,.1,.8),(.5,.4,.08),self.pad)
                self.rod('Assistance slide',(0,.42,.1),(0,.42,1.45),.034)
        if a in ['chest-machine','shoulder-machine','row-machine','pec-deck','reverse-deck','lever-lat']:
            y=.40 if a not in ['row-machine','reverse-deck','lever-lat'] else -.52
            for sign in [-1,1]: self.rod('Machine frame',(sign*.56,y,.035),(sign*.56,y,1.83),.035)
            self.rod('Machine crossbeam',(-.56,y,1.83),(.56,y,1.83),.035)
            if a=='row-machine': self.box('Chest support',(0,-.04,.88),(.29,.095,.27),self.pad)
            for s,sign in [('L',1),('R',-1)]:
                self.make_handle(s)
                pivot=(sign*.56,y,1.60 if a!='row-machine' else .54)
                rod=self.rod('Lever '+s,pivot,(sign*.25,0,1),.022,self.metal)
                self.dynamic.append(('lever',rod,pivot,s))
        if a=='preacher-bar':
            pad=self.box('Preacher arm pad',(0,-.26,.94),(.64,.40,.12),self.pad)
            pad.rotation_quaternion=Quaternion(V((1,0,0)),-.53)
            self.rod('Preacher stand',(0,-.26,.04),(0,-.26,.85),.035)
        if a=='tbar':
            self.tools['tbar']=self.rod('T bar lever',(0,.95,.07),(0,-.3,.6),.02,self.metal)
            self.tools['handle']=self.cyl('T grip',.014,.48,(0,0,0),self.metal)
            self.tools['tplate']=self.cyl('T bar weight',.18,.07,(0,0,0),self.rubber)
        if a in ['lying-curl','seated-curl','leg-extension','calf-machine','hip-machine','leg-press','hack-machine']:
            for sign in [-1,1]:
                self.rod('Lower body machine base',(sign*.45,-.55,.035),(sign*.45,.70,.035),.036)
            if a!='hack-machine':
                for s in ['L','R']: self.make_handle(s)
            if a in ['lying-curl','seated-curl','leg-extension']:
                self.tools['roller']=self.cyl('Ankle roller',.07,.60,(0,0,0),self.pad)
                self.dynamic.append(('roller-link',self.rod('Leg lever',(0,0,0),(0,0,1),.026,self.metal),(0,-.32,.56) if a!='lying-curl' else (0,.55,.55),None))
            if a=='hip-machine':
                for s in ['L','R']: self.tools['thigh_pad_'+s]=self.box('Thigh pad '+s,(0,0,0),(.10,.20,.21),self.pad)
            if a=='calf-machine':
                self.tools['calf_pad']=self.cyl('Calf thigh roller',.065,.55,(0,0,0),self.pad)
                self.box('Calf foot step',(0,-.54,.035),(.64,.24,.07),self.rubber)
            if a=='leg-press':
                pad=self.box('Leg press backrest',(0,.37,.61),(.38,.10,.70),self.pad); pad.rotation_quaternion=Quaternion(V((1,0,0)),-.63)
                self.box('Leg press seat',(0,.16,.28),(.40,.42,.09),self.pad)
                self.tools['footplate']=self.box('Leg press footplate',(0,-.7,.8),(.70,.09,.52),self.rubber)
                self.tools['footplate'].rotation_quaternion=Quaternion(V((1,0,0)),-.78)
                for x in [-.46,.46]: self.rod('Leg press rail',(x,-.25,.48),(x,-1.20,1.43),.021,self.metal)
            if a=='hack-machine':
                for x in [-.44,.44]:
                    self.rod('Hack rail',(x,.14,1.70),(x,.87,.14),.026,self.metal)
                    self.rod('Hack rail foot',(x,.87,.025),(x,.87,.14),.028)
                    self.rod('Hack rear base',(x,.6,.035),(x,.96,.035),.036)
                self.tools['hack_pad']=self.box('Hack back pad',(0,.2,1.2),(.42,.10,.7),self.pad)
                self.tools['hack_carriage']=self.rod('Hack carriage',(0,0,0),(0,0,1),.024,self.metal)
                for s in ['L','R']:
                    self.make_handle(s)
                    self.tools['hack_shoulder_'+s]=self.box('Hack shoulder pad '+s,(0,0,0),(.16,.20,.08),self.pad)
                self.box('Hack footplate',(0,-.11,.015),(.82,.62,.03),self.rubber)
        if a=='treadmill':
            deck=self.box('Treadmill deck',(0,0,.15 if v=='incline-walk' else .028),(.75,1.85,.08),self.rubber)
            if v=='incline-walk': deck.rotation_quaternion=Quaternion(V((1,0,0)),-.14)
            for x in [-.41,.41]:
                self.rod('Treadmill post',(x,-.69,.07),(x,-.74,1.24),.026)
                self.rod('Treadmill rail',(x,-.74,1.24),(x,-.34,1.08),.024)
            self.box('Treadmill console',(0,-.76,1.25),(.74,.22,.08),self.rubber)
            self.tools['belt_mark']=self.box('Moving belt seam',(0,0,.071),(.62,.009,.003),self.accent,.001)
        if a=='bike':
            for aa,bb in [((0,.15,.20),(0,.18,.84)),((0,.15,.20),(0,-.18,.38)),((0,-.18,.38),(0,-.48,.98)),((0,-.48,.98),(0,.18,.84))]: self.rod('Bicycle frame',aa,bb,.032)
            self.box('Bike saddle',(0,.18,.84),(.25,.32,.07),self.pad)
            self.cyl('Flywheel',.27,.10,(0,-.44,.30),self.rubber)
            self.rod('Handlebar',(-.30,-.55,1.107),(.30,-.55,1.107),.019,self.metal)
            for s in ['L','R']: self.tools['pedal_'+s]=self.box('Bike pedal '+s,(0,0,0),(.16,.14,.025),self.rubber)
            for s in ['L','R']: self.dynamic.append(('crank',self.rod('Bike crank '+s,(0,0,0),(0,0,1),.017,self.metal),(0,-.18,.38),s))
        if a=='elliptical':
            self.rod('Elliptical mast',(0,-.66,.05),(0,-.66,1.48),.042)
            self.cyl('Elliptical wheel',.27,.18,(0,.47,.31),self.rubber)
            for s in ['L','R']:
                self.tools['pedal_'+s]=self.box('Elliptical footbed '+s,(0,0,0),(.20,.43,.04),self.rubber)
                self.make_handle(s)
                self.dynamic.append(('lever',self.rod('Elliptical arm '+s,(0,0,0),(0,0,1),.024,self.metal),(0,-.6,.4),s))
        if a=='rower':
            self.rod('Rower rail',(0,-.72,.23),(0,.7,.23),.04,self.metal)
            self.cyl('Rower flywheel',.24,.28,(0,-.94,.29),self.rubber)
            self.tools['rower_seat']=self.box('Sliding rower seat',(0,.1,.28),(.37,.31,.09),self.pad)
            for sign in [-1,1]: self.box('Rower footrest',(sign*.15,-.66,.16),(.17,.22,.10),self.rubber)
            self.tools['handle']=self.cyl('Rower handle',.015,.46,(0,0,0),self.metal)
            self.dynamic.append(('cable',self.rod('Rower chain',(0,0,0),(0,0,1),.004,self.line),(0,-.88,.40),None))
        if a=='stepmill':
            for j in range(5): self.tools['step_'+str(j)]=self.box('Stepmill stair '+str(j),(0,0,0),(.75,.26,.13),self.rubber,.008)
            for x in [-.45,.45]: self.rod('Stepmill rail',(x,-.62,.10),(x,-.65,1.3),.025); self.rod('Stepmill grip',(x,-.65,1.3),(x,-.23,1.11),.021)
        self.update(first,0)

    def box(self,name,center,size,mat=None,bevel=.025):
        obj=S.box(name,center,size,mat or self.metal,bevel); self.objects.append(obj); return obj
    def cyl(self,name,radius,length,center,mat):
        obj=S.cylinder(name,mat,radius,length,center); self.objects.append(obj); return obj
    def rod(self,name,a,b,radius,mat=None):
        obj=self.cyl(name,radius,1,(0,0,0),mat or self.metal); self.rod_update(obj,a,b); return obj
    @staticmethod
    def rod_update(obj,a,b):
        a,b=V(a),V(b); obj.location=(a+b)/2
        obj.rotation_quaternion=V((0,0,1)).rotation_difference(b-a)
        obj.scale=(1,1,(b-a).length)
    def make_handle(self,side):
        self.tools['handle_'+side]=self.cyl('Hand grip '+side,.014,.15,(0,0,0),self.metal)
    def update(self,p,phase):
        j=p['joints']; grips={s:j[s]['grip'] for s in j}; center=(grips['L']+grips['R'])/2
        a=self.spec['apparatus']; f=self.spec['family']; v=self.spec['variant']
        for s in ['L','R']:
            if s in self.tools:
                tool=self.tools[s]; tool.location=grips[s]; tool.rotation_mode='QUATERNION'
                tool.rotation_quaternion=V((1,0,0)).rotation_difference(p['hands'][s]['axis'])
                if a in ['goblet','single-dumbbell']:
                    tool.location=center; tool.rotation_quaternion=V((1,0,0)).rotation_difference(V((0,0,1)))
            if 'handle_'+s in self.tools:
                tool=self.tools['handle_'+s]; tool.location=grips[s]; tool.rotation_quaternion=V((1,0,0)).rotation_difference(p['hands'][s]['axis'])
            if 'pedal_'+s in self.tools: self.tools['pedal_'+s].location=j[s]['ankle']+V((0,-.08,-.075))
            if 'thigh_pad_'+s in self.tools: self.tools['thigh_pad_'+s].location=j[s]['knee']+V(((.065 if v=='abduction' else -.065)*(1 if s=='L' else -1),.035,.025))
        if 'bar' in self.tools: self.tools['bar'].location=center
        if 'handle' in self.tools:
            handle=self.tools['handle']; handle.location=center
            if handle.get('adjust_length'):
                handle.rotation_quaternion=V((0,0,1)).rotation_difference(grips['L']-grips['R'])
                handle.scale.z=(grips['L']-grips['R']).length+.10
        rope_center=center+V((0,-.20,.14 if v!='overhead-cable' else 0))
        if 'rope_join' in self.tools: self.tools['rope_join'].location=rope_center
        for s in ['L','R']:
            if 'rope_'+s in self.tools:
                self.rod_update(self.tools['rope_'+s],rope_center,grips[s])
                self.tools['rope_end_'+s].location=grips[s]
            if 'vbar_'+s in self.tools: self.rod_update(self.tools['vbar_'+s],center+V((0,-.11,0)),grips[s])
        if 'tbar' in self.tools:
            self.rod_update(self.tools['tbar'],(0,.95,.07),center+V((0,-.22,0)))
            self.tools['tplate'].location=center+V((0,-.20,-.03)); self.tools['tplate'].rotation_quaternion=V((0,0,1)).rotation_difference(center-V((0,.95,.07)))
        if 'roller' in self.tools:
            lower=(j['L']['ankle']-j['L']['knee']).normalized()
            rotation=V((0,0,-1)).rotation_difference(lower)
            self.tools['roller'].location=(j['L']['ankle']+j['R']['ankle'])/2+rotation@V((0,.055 if f=='leg_curl' else -.055,0))
        if 'calf_pad' in self.tools: self.tools['calf_pad'].location=(j['L']['knee']+j['R']['knee'])/2+V((0,.03,.085))
        if 'knee_pad' in self.tools: self.tools['knee_pad'].location=(j['L']['knee']+j['R']['knee'])/2-V((0,0,.055))
        if 'footplate' in self.tools: self.tools['footplate'].location=(j['L']['ankle']+j['R']['ankle'])/2+V((0,-.017,.144))
        if 'hack_pad' in self.tools:
            pad=self.tools['hack_pad']; pad.location=p['hip']+V((0,.15,.29)); pad.rotation_quaternion=Quaternion(V((1,0,0)),p['pitch'])
            self.rod_update(self.tools['hack_carriage'],(-.44,pad.location.y+.06,pad.location.z),(.44,pad.location.y+.06,pad.location.z))
            for s in ['L','R']:
                self.tools['hack_shoulder_'+s].location=j[s]['shoulder']+V((0,.06,.065))
                self.tools['hack_shoulder_'+s].rotation_quaternion=Quaternion(V((1,0,0)),p['pitch'])
        if 'rower_seat' in self.tools: self.tools['rower_seat'].location=p['hip']-V((0,0,.11))
        if 'belt_mark' in self.tools:
            mark=self.tools['belt_mark']; mark.location.y=-.82+1.64*phase
            if v=='incline-walk': mark.location.z=.191-.14*mark.location.y; mark.rotation_quaternion=Quaternion(V((1,0,0)),-.14)
        for k in range(5):
            if 'step_'+str(k) in self.tools:
                yy=-.70+((k*.26+phase*.52)%1.30)
                # 在固定进出口裁切踏板，回卷时整块踏板已退出可见范围。
                # 只对中心做取模会在循环边界突然凭空出现最高的一阶。
                start=max(-.57,yy-.13); end=min(.47,yy+.13)
                stair=self.tools['step_'+str(k)]
                stair.scale.y=max(0,end-start)/.26
                stair.location=V((0,(start+end)/2,.27-.5*(yy+.18)-.065))
        for kind,obj,pivot,s in self.dynamic:
            target=grips[s] if s else center
            if kind=='cable' and 'rope_join' in self.tools: target=rope_center
            if kind=='cable' and 'vbar_L' in self.tools: target=center+V((0,-.11,0))
            if kind=='roller-link': target=self.tools['roller'].location
            if kind=='crank': target=j[s]['ankle']+V((0,-.08,-.07))
            self.rod_update(obj,pivot,target)
    def keyframe(self,frame):
        for obj in self.objects:
            for key in ['location','rotation_quaternion','scale']: obj.keyframe_insert(key,frame=frame)
    def remove(self):
        for obj in self.objects: bpy.data.objects.remove(obj,do_unlink=True)
