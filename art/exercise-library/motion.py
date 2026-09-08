"""固定骨长的全身动作编排。坐标 X 左右、-Y 正面、Z 向上，单位米。"""
import math
from mathutils import Vector as V, Matrix, Quaternion

PI=math.pi
def rx(angle): return Quaternion(V((1,0,0)),angle)
def rz(angle): return Quaternion(V((0,0,1)),angle)
def lerp(a,b,t): return V(a).lerp(V(b),t)
def normalized(value): return V(value).normalized()

class Motion:
    def __init__(self,rig):
        self.rig=rig; self.bones=rig.data.bones
        self.rest_hip=V((0,-.0031726768,.9611701965))
        self.records=[]
        self.ordered=[]
        def walk(b):
            self.ordered.append(b)
            for child in b.children: walk(child)
        for b in self.bones:
            if not b.parent: walk(b)

    def length(self,a,b,side): return (self.bones[f'{a}.{side}'].head_local-self.bones[f'{b}.{side}'].head_local).length

    def ik(self,start,end,l1,l2,hint):
        start,end=V(start),V(end); delta=end-start; dist=delta.length
        limit=min(max(dist,abs(l1-l2)+.001),l1+l2-.0005)
        self.errors.append(abs(dist-limit))
        if abs(dist-limit)>1e-5: self.details[self.context]=abs(dist-limit)
        direction=delta.normalized(); end=start+direction*limit
        bend=V(hint)-direction*V(hint).dot(direction)
        if bend.length<1e-6: bend=direction.cross(V((1,0,0)))
        bend.normalize()
        along=(l1*l1-l2*l2+limit*limit)/(2*limit)
        joint=start+direction*along+bend*math.sqrt(max(0,l1*l1-along*along))
        return joint,end

    def create(self,spec,phase):
        f,v=spec['family'],spec['variant']; u=(1-math.cos(phase*2*PI))/2
        sine=math.sin(phase*2*PI); self.errors=[]; self.details={}; self.context=''
        hip=V((0,0,.950)); pitch=0.; tilt=Quaternion(); foot_rotation={'L':Quaternion(),'R':Quaternion()}
        feet={s:V((sign*.19,-.015,.074386)) for s,sign in [('L',1),('R',-1)]}
        wrists={}; hints={}; leg_hints={s:V((0,-1,0)) for s in ['L','R']}; hands={}; straight_legs={}
        support={}; arm_mode='down'; front=V((0,-1,0)); up=V((0,0,1))
        seated=f in ['pulldown','hip_machine','leg_extension'] or (f in ['row'] and v in ['seated','supported']) or (f=='leg_curl' and v=='seated') or (f=='calf' and v=='seated') or (f=='overhead' and v in ['seated','arnold']) or (f=='fly' and v=='seated') or (f=='press' and v=='seated') or (f=='raise' and v=='pec-reverse') or (f=='curl' and v in ['preacher','incline'])
        supine=(f=='press' and v!='seated') or (f=='fly' and v=='supine') or (f=='triceps' and v=='skull')
        if seated:
            hip=V((0,.10,.57)); feet={s:V((sign*.17,-.42,.074386)) for s,sign in [('L',1),('R',-1)]}
            pitch=-.12 if f in ['pulldown','overhead'] else 0
            support['seat']=(0,.12,.48)
        if supine:
            incline=v=='incline'; pitch=-PI/3 if incline else -PI/2
            hip=V((0,-.30,.57)); feet={s:V((sign*.24,-.70,.074386)) for s,sign in [('L',1),('R',-1)]}
            support['bench']={'hip':list(hip),'pitch':pitch}
        if f=='curl' and v=='incline': pitch=-.40
        if f=='squat':
            width=.205 if v not in ['goblet','bodyweight'] else .23
            hip=V((0,.02+.19*u,.950-.40*u)); pitch=.10+.36*u
            if v=='hack':
                hip.z=.925-.39*u
                hip.y=.14+(1.7-(hip.z+.29))*.47-.21; pitch=-.44
            feet={s:V((sign*width,-.07,.074386)) for s,sign in [('L',1),('R',-1)]}
            if v=='smith':
                feet={s:p+V((0,-.09,0)) for s,p in feet.items()}; hip.z-=.025
        if f=='hinge':
            depth={'romanian':.105,'deadlift':.24,'sumo':.37}[v]
            pitch=(.10+({'romanian':1.04,'deadlift':1.20,'sumo':.82}[v])*u)
            hip=V((0,.015+(.27 if v!='sumo' else .16)*u,.95-depth*u))
            if v=='sumo': hip.z-=.032
            width=.37 if v=='sumo' else .185
            feet={s:V((sign*width,-.055,.074386)) for s,sign in [('L',1),('R',-1)]}
        if f=='row' and v in ['bent','single','tbar']:
            hip=V((0,.14,.86)); pitch=1.02 if v!='single' else 1.22
            feet={s:V((sign*.23,-.08,.074386)) for s,sign in [('L',1),('R',-1)]}
            if v=='single':
                hip=V((0,.18,.89)); feet['R']=V((-.23,.56,.70)); leg_hints['R']=V((0,-1,0)); support['single_bench']=True
        if f=='raise' and v=='reverse': hip=V((0,.12,.87)); pitch=1.15
        if f=='straight_pull': hip=V((0,.04,.93)); pitch=.22
        if f=='lunge':
            hip=V((0,.03,.82-.30*u)); pitch=.07
            feet={'L':V((.15,-.43,.074386)),'R':V((-.15,.45,.13))}
            foot_rotation['R']=rx(.47)
        if f=='dip':
            hip=V((0,.05,.97-.20*u)); pitch=.17
            feet={s:V((sign*.13,.22,.35-.2*u)) for s,sign in [('L',1),('R',-1)]}
            support['dip']=True
        if f=='pullup' or (f=='core' and v=='hanging-raise'):
            bottom=1.13 if v=='wide' else 1.075
            travel=(1.51-bottom)*u if f=='pullup' else 0
            hip=V((0,.04,bottom+travel)); pitch=-.07
            feet={s:V((sign*.15,.06,bottom-.87+travel)) for s,sign in [('L',1),('R',-1)]}
            if v=='assisted': feet={s:V((sign*.13,.40,.76+travel)) for s,sign in [('L',1),('R',-1)]}
            support['pullup']=True
        if f=='pushup' or (f=='core' and v=='plank'):
            alpha=.10+.18*u if f=='pushup' else .11+.002*math.cos(phase*2*PI)
            pitch=PI/2-alpha
            hip=V((0,1.13-.875*math.cos(alpha),.17+.875*math.sin(alpha)))
            feet={s:V((sign*.15,1.13,.17)) for s,sign in [('L',1),('R',-1)]}
            foot_rotation={s:rx(.55) for s in feet}
            if v=='knees':
                alpha=.25+.30*u; pitch=PI/2-alpha
                offset=rx(pitch)@(self.bones['upperleg01.L'].head_local-self.rest_hip)
                length=math.sqrt(self.length('upperleg01','lowerleg01','L')**2-(.14-offset.x)**2)
                hip=V((0,.70,.068))+V((0,-math.cos(alpha),math.sin(alpha)))*length-V((0,offset.y,offset.z))
                for s,sign in [('L',1),('R',-1)]:
                    knee=V((sign*.14,.70,.068)); straight_legs[s]=knee
                    feet[s]=knee+normalized((0,.38,.23))*self.length('lowerleg01','foot',s)
                    foot_rotation[s]=rx(-.4)
            support['mat']=True
        if f=='bridge':
            bench=v=='bench'; shoulder=V((0,.40,.56 if bench else .15))
            hip=V((0,-.06,.28+.27*u if bench else .15+.23*u))
            pitch=-math.atan2((shoulder-hip).y,(shoulder-hip).z)
            feet={s:V((sign*.18,-.62,.074386)) for s,sign in [('L',1),('R',-1)]}
            support['hip_bench']=bench
        if f=='leg_press':
            hip=V((0,.17,.36)); pitch=-.63
            for s,sign in [('L',1),('R',-1)]:
                feet[s]=V((sign*.20,-.30-.24*u,.57+.29*u)); leg_hints[s]=V((sign*.18,0,1)); foot_rotation[s]=rx(-PI*.75)
            support['leg_press']=True
        if f=='leg_curl' and v=='lying':
            hip=V((0,.12,.65)); pitch=PI/2
            for s,sign in [('L',1),('R',-1)]:
                knee=V((sign*.14,.55,.62)); angle=.10+1.80*u
                feet[s]=knee+V((0,math.cos(angle),math.sin(angle)))*.454
                foot_rotation[s]=rx(PI/2-angle)
                straight_legs[s]=knee
            support['lying_bench']=True
        if f in ['leg_curl','leg_extension'] and v=='seated':
            for s,sign in [('L',1),('R',-1)]:
                knee=V((sign*.14,-.32,.56)); angle=(.12+1.36*u) if f=='leg_extension' else (1.43-1.3*u)
                feet[s]=knee+V((0,-math.sin(angle),-math.cos(angle)))*.454
                straight_legs[s]=knee; foot_rotation[s]=rx(-angle*.55)
        if f=='hip_machine':
            angle=(.12+.50*u) if v=='abduction' else (.62-.50*u)
            for s,sign in [('L',1),('R',-1)]:
                knee=V((sign*(.113+.43*math.sin(angle)),.10-.43*math.cos(angle),.57))
                feet[s]=knee+V((0,0,-.455)); straight_legs[s]=knee
        if f=='calf':
            for s,sign in [('L',1),('R',-1)]:
                if v=='seated': feet[s].z+=.07
                rot=rx(.33*u); foot_rotation[s]=rot
                rest=self.bones[f'foot.{s}'].head_local; toe=self.bones[f'toe2-3.{s}'].tail_local
                delta=toe-rest
                feet[s]+=delta-rot@delta
            if v!='seated': hip.z+=.066*u
        if f=='core' and v in ['crunch','leg-raise','dead-bug']:
            hip=V((0,-.03,.15)); pitch=-PI/2 + (.32*u if v=='crunch' else 0)
            for s,sign in [('L',1),('R',-1)]:
                feet[s]=V((sign*.15,-.68,.075))
            support['mat']=True
            if v=='leg-raise':
                for s,sign in [('L',1),('R',-1)]: feet[s]=hip+V((sign*.113,-math.cos(.12+1.24*u)*.86,math.sin(.12+1.24*u)*.86))
            if v=='dead-bug':
                for s,sign in [('L',1),('R',-1)]:
                    k=(1+sign*math.cos(phase*2*PI))/2
                    feet[s]=lerp((sign*.13,-.69,.23),(sign*.13,-.39,.85),k)
                    leg_hints[s]=V((0,0,1))
        if f=='core' and v=='cable-crunch':
            pitch=.22+.64*u
            offset=rx(pitch)@(self.bones['upperleg01.L'].head_local-self.rest_hip)
            length=math.sqrt(self.length('upperleg01','lowerleg01','L')**2-(.15-offset.x)**2-.1**2)
            hip=V((0,.08,.076+length))-V((0,offset.y,offset.z))
            for s,sign in [('L',1),('R',-1)]:
                knee=V((sign*.15,-.02,.076)); straight_legs[s]=knee
                feet[s]=knee+V((0,self.length('lowerleg01','foot',s),0)); foot_rotation[s]=rz(PI)
        if f=='core' and v=='side-plank':
            hip=V((0,.27,.50+.003*math.cos(phase*2*PI)))
            tilt=rz(PI/2)
            pitch=PI/2-.06
            feet={'L':V((.02,1.00,.16)),'R':V((0,1.00,.074))}
            foot_rotation={s:rz(PI) for s in feet}
            support['mat']=True
        if f=='cardio':
            if v in ['run','incline-walk','stairs','elliptical']:
                a=phase*2*PI; stride=.36 if v=='run' else .24
                base=.17 if v=='stairs' else .145
                hip=V((0,0,(.925 if v=='run' else .97)+(.018 if v=='run' else .008)*math.cos(a*2))); pitch=.10 if v!='incline-walk' else .17
                for s,sign in [('L',1),('R',-1)]:
                    cycle=a+(0 if sign==1 else PI)
                    feet[s]=V((sign*.13,stride*math.cos(cycle),base+.12*max(0,math.sin(cycle))))
                    if v=='stairs': feet[s]=V((sign*.14,.20*math.cos(cycle),.18+.17*(1+math.sin(cycle))/2))
                    if v=='elliptical': feet[s]=V((sign*.15,.28*math.cos(cycle),.18+.065*math.sin(cycle)))
                    if v=='stairs':
                        step_phase=(phase+(0 if sign==1 else .5))%1
                        if step_phase<.5:
                            yy=-.18+.52*step_phase; sole=.27-.26*step_phase
                        else:
                            t=2*step_phase-1; ease=t*t*(3-2*t)
                            yy=.08-.26*ease; sole=.14+.13*ease+.14*math.sin(PI*t)
                        feet[s]=V((sign*.14,yy,sole+.074386))
                        hip.z=1.08+.003*math.cos(phase*4*PI)
                    if v=='incline-walk':
                        feet[s].z=.264386-.14*feet[s].y+.09*max(0,math.sin(cycle))
                        hip.z=1.075+.004*math.cos(phase*4*PI)
                        foot_rotation[s]=rx(-.14)
            elif v=='cycle':
                hip=V((0,.18,.98)); pitch=.45
                for s,sign in [('L',1),('R',-1)]:
                    a=phase*2*PI+(0 if sign==1 else PI)
                    feet[s]=V((sign*.13,-.18+.165*math.cos(a),.38+.165*math.sin(a)))
            elif v=='row':
                hip=V((0,-.20+.40*u,.39)); pitch=.30-.55*u
                feet={s:V((sign*.14,-.64,.24)) for s,sign in [('L',1),('R',-1)]}
                leg_hints={s:V((0,0,1)) for s in feet}

        q=rx(pitch)@tilt
        transform=Matrix.Translation(hip)@q.to_matrix().to_4x4()@Matrix.Translation(-self.rest_hip)
        up=q@V((0,0,1)); front=q@V((0,-1,0)); right=q@V((1,0,0))
        points={}; overrides={}
        root=self.bones['root']; overrides['root']=transform@root.matrix_local
        # 卷腹在腰椎以上再分配屈曲，避免把整个躯干当成僵硬直板。
        if f=='core' and v in ['crunch','cable-crunch']:
            pivot=transform@self.bones['spine03'].head_local
            curve=Matrix.Translation(pivot)@rx(.18*u).to_matrix().to_4x4()@Matrix.Translation(-pivot)
        else: curve=Matrix.Identity(4)
        torso=curve@transform
        overrides['spine03']=torso@self.bones['spine03'].matrix_local

        for s,sign in [('L',1),('R',-1)]:
            shoulder=torso@self.bones[f'upperarm01.{s}'].head_local
            hip_joint=transform@self.bones[f'upperleg01.{s}'].head_local
            l1=self.length('upperarm01','lowerarm01',s); l2=self.length('lowerarm01','wrist',s)
            # 默认双臂自然下垂，常规站姿不会使用原模型的张臂静止姿势。
            target=shoulder+right*(sign*.03)-up*(l1+l2-.025)+front*.05
            hint=front; palm=None; grip=True
            if f=='press':
                width=.23 if v=='close' else .33
                target=shoulder+right*(sign*(width-.194)*(1-u))+front*(.08+.40*u)-up*.055*(1-u)
                if spec['apparatus']=='smith': target=shoulder+right*(sign*(width-.194)*(1-u))+front*(.08+.40*u)-up*.03
                hint=right*sign-up*.65; palm=front
            elif f=='fly':
                a=.20+1.20*(1-u)
                target=shoulder+right*(sign*.515*math.sin(a))+front*(.515*math.cos(a))-up*.025
                hint=right*sign-up*.7; palm=front
            elif f=='overhead':
                target=shoulder+right*(sign*(.15*(1-u)+.02))+up*(.08+.41*u)+front*.06
                if v=='arnold': target=shoulder+right*(sign*(.08+.04*u))+up*(.05+.45*u)+front*(.20*(1-u)+.04)
                hint=right*sign-front*.15; palm=up
            elif f=='raise':
                a=.10+1.37*u
                if v=='front': target=shoulder+front*(.48*math.sin(a))-up*(.48*math.cos(a)); hint=front
                elif v in ['reverse','pec-reverse']:
                    target=shoulder+right*(sign*.47*math.sin(a))+front*(.47*math.cos(a)); hint=-up
                else: target=shoulder+right*(sign*.49*math.sin(a))-up*(.49*math.cos(a))+front*.025; hint=front
                palm=(target-shoulder).normalized(); grip=True
            elif f=='curl':
                upper_dir=(front*(.65 if v=='preacher' else -.17 if v=='incline' else .08)-up).normalized()
                elbow=shoulder+upper_dir*l1
                angle=.22+1.96*u
                direction=(front*math.sin(angle)-up*math.cos(angle)).normalized()
                target=elbow+direction*l2; hints[s]=elbow; palm=direction
            elif f=='triceps':
                if v in ['overhead','overhead-cable','skull']:
                    elbow=shoulder+up*l1+front*.015
                    if spec['apparatus']=='single-dumbbell': elbow=shoulder+(up-right*sign*.36).normalized()*l1
                    a=.10+1.8*(1-u); direction=up*math.cos(a)-front*math.sin(a)
                    if spec['apparatus']=='single-dumbbell': direction=(direction-right*sign*.22).normalized()
                    target=elbow+direction*l2; hints[s]=elbow; palm=direction
                    if v=='skull':
                        elbow=shoulder+front*l1; a=.12+1.65*(1-u)
                        direction=front*math.cos(a)+up*math.sin(a); target=elbow+direction*l2; hints[s]=elbow; palm=direction
                else:
                    elbow=shoulder-up*l1+front*.03
                    a=.15+1.40*(1-u); direction=front*math.sin(a)-up*math.cos(a)
                    if v=='rope': direction=(direction+right*sign*.18*u).normalized()
                    target=elbow+direction*l2; hints[s]=elbow; palm=direction
            elif f in ['pulldown','pullup'] or (f=='core' and v=='hanging-raise'):
                width=.43 if v=='wide' else .22
                if f=='pulldown':
                    target=shoulder+right*(sign*(width-.194))+up*(.44-.40*u)+front*(.06+.075*u)
                else: target=V((sign*width,-.06,2.07))
                hint=right*sign+front*.2; palm=up
            elif f=='row':
                if v=='single' and s=='R': target=V((-.24,-.20,.56)); hint=front; grip=False
                else:
                    target=shoulder+front*(.48-.29*u)-up*(.10+.20*u)
                    hint=-front-up*.35; palm=-up if v in ['bent','single','tbar'] else front
            elif f=='straight_pull':
                a=1.75-1.40*u; target=shoulder+front*(.51*math.sin(a))-up*(.51*math.cos(a)); hint=front; palm=target-shoulder
            elif f=='face_pull':
                target=shoulder+right*sign*(.04+.18*u)+front*(.48-.41*u)+up*.04*u; hint=-up; palm=front
            elif f in ['squat','lunge']:
                if v in ['back','smith','hack','barbell']:
                    target=shoulder+right*(sign*.11)-front*.025-up*.055; hint=-up-front; palm=up
                    if v=='smith': target.y=-.078*up.y-.013*up.z
                elif v=='front':
                    target=shoulder-right*(sign*.055)+front*.055+up*.015; hint=front-up*.1; palm=up
                elif v=='goblet':
                    target=shoulder-right*(sign*.11)+front*.19-up*.14; hint=-up; palm=up
                else: target=shoulder+front*.48-right*(sign*.035); hint=-up; grip=False; palm=front
            elif f=='hinge':
                target=shoulder+V((sign*.025,-.015,-.515)); hint=V((0,-1,0)); palm=V((0,0,-1))
            elif f=='dip':
                target=V((sign*.31,.025,1.02)); hint=V((sign*.3,1,0)); palm=V((0,0,-1))
            elif f=='pushup' or (f=='core' and v=='plank'):
                if f=='pushup': target=V((sign*.30,-.18,.045)); hint=V((sign*.3,.5,0)); palm=V((0,-1,0))
                else:
                    elbow=shoulder-V((0,0,l1)); target=elbow+V((0,-l2,0)); hints[s]=elbow; palm=V((0,-1,0))
                grip=False
            elif f=='bridge':
                if spec['apparatus'] in ['hip-barbell','hip-smith']:
                    target=hip+V((sign*.26,-.05,.075)); hint=V((sign,0,-1)); palm=V((0,-1,0))
                else: target=shoulder+V((sign*.10,-.47,-.03)); hint=V((sign,0,-1)); grip=False; palm=V((0,-1,0))
            elif f in ['leg_curl','leg_extension','hip_machine','leg_press'] or (f=='calf' and v=='seated'):
                if f=='leg_curl' and v=='lying': target=shoulder+V((sign*.12,-.25,-.10)); hint=V((sign,0,0))
                else: target=shoulder-up*.43+right*sign*.09; hint=front
                palm=-up
            elif f=='core':
                if v=='crunch': target=shoulder+front*.20-right*sign*.13-up*.10; hint=right*sign
                elif v=='leg-raise': target=shoulder-up*.49+right*sign*.07; hint=-front; grip=False; palm=-up
                elif v=='dead-bug':
                    k=(1+sign*math.cos(phase*2*PI))/2
                    target=shoulder+(front*.50).lerp(up*.50,k); hint=right*sign; grip=False; palm=(target-shoulder).normalized()
                elif v=='cable-crunch': target=shoulder+front*.06+up*.08; hint=front; palm=up
                elif v=='side-plank':
                    if s=='R': target=V((.20,-.30,.08)); hint=V((0,0,-1)); palm=V((1,0,0))
                    else: target=hip+V((0,-.03,.12)); hint=V((0,.2,1)); palm=-up
                    grip=False
            elif f=='cardio':
                if v in ['run','incline-walk','stairs']:
                    a=phase*2*PI+(0 if sign==1 else PI)
                    elbow=shoulder+V((sign*.03,.12*math.cos(a),-.23))
                    direction=normalized((0,-.85,-.32+(.3 if v=='run' else 0)))
                    target=elbow+direction*l2; hints[s]=elbow; palm=direction
                elif v=='cycle': target=V((sign*.24,-.47,1.12)); hint=V((sign*.3,0,-1)); palm=V((0,-1,0))
                elif v=='elliptical': target=V((sign*.24,-.35-.12*sign*sine,1.28)); hint=V((sign*.2,0,-1)); palm=up
                elif v=='row':
                    pull=max(0,min(1,(u-.45)/.55)); pull=pull*pull*(3-2*pull)
                    target=shoulder+front*(.49-.26*pull)-up*.20*pull; hint=-up; palm=front

            # 死虫和悬垂举腿各自有独立腿轨迹。
            if f=='core' and v=='hanging-raise':
                angle=.05+1.32*u; feet[s]=hip_joint+V((0,-math.sin(angle),-math.cos(angle)))*.875; leg_hints[s]=front
            if f=='core' and v=='leg-raise':
                angle=.12+1.24*u
                feet[s]=hip_joint+V((0,-math.cos(angle),math.sin(angle)))*(self.length('upperleg01','lowerleg01',s)+self.length('lowerleg01','foot',s)-.004)
            self.context=s+'_arm'
            if s in hints:
                # 直接肘点仍通过长度投影，记录投影量用于校准。
                elbow=shoulder+(V(hints[s])-shoulder).normalized()*l1
                wrist=elbow+(target-V(hints[s])).normalized()*l2
            else: elbow,wrist=self.ik(shoulder,target,l1,l2,hint)
            self.context=s+'_leg'
            knee,ankle=self.ik(hip_joint,feet[s],self.length('upperleg01','lowerleg01',s),self.length('lowerleg01','foot',s),leg_hints[s])
            if s in straight_legs:
                knee=hip_joint+(straight_legs[s]-hip_joint).normalized()*self.length('upperleg01','lowerleg01',s)
                ankle=knee+(feet[s]-straight_legs[s]).normalized()*self.length('lowerleg01','foot',s)
            points[s]={'shoulder':shoulder,'elbow':elbow,'wrist':wrist,'hip':hip_joint,'knee':knee,'ankle':ankle}
            self.segment(overrides,s,'upperarm01','lowerarm01',['upperarm01','upperarm02'],shoulder,elbow)
            self.segment(overrides,s,'lowerarm01','wrist',['lowerarm01','lowerarm02'],elbow,wrist)
            self.segment(overrides,s,'upperleg01','lowerleg01',['upperleg01','upperleg02'],hip_joint,knee)
            self.segment(overrides,s,'lowerleg01','foot',['lowerleg01','lowerleg02'],knee,ankle)
            bone=self.bones[f'foot.{s}']; rot=foot_rotation[s]
            overrides[bone.name]=Matrix.Translation(ankle)@rot.to_matrix().to_4x4()@bone.matrix_local.to_3x3().to_4x4()
            if palm is None: palm=wrist-elbow
            hand_dir=V(palm).normalized()
            axis=V((1,0,0))
            if f=='pullup' and v=='underhand': axis=-axis
            if spec['variant']=='hammer' and f=='curl': axis=hand_dir.cross(V((1,0,0))).normalized()
            if v=='arnold' and f=='overhead': axis=V((math.cos((1-u)*PI/2),-sign*math.sin((1-u)*PI/2),0))
            if f=='raise' and v in ['lateral','reverse','pec-reverse']: axis=front
            axis=(axis-hand_dir*axis.dot(hand_dir)).normalized()
            if axis.length<.1: axis=hand_dir.cross(V((0,1,0))).normalized()
            normal=axis.cross(hand_dir).normalized()
            grip_pos=self.hand(overrides,s,wrist,hand_dir,axis,normal,grip)
            points[s]['grip']=grip_pos; hands[s]={'axis':axis,'direction':hand_dir,'normal':normal,'closed':grip}

        absolute={}
        for bone in self.ordered:
            parent=bone.parent
            matrix=overrides.get(bone.name)
            if matrix is None:
                matrix=absolute[parent.name]@parent.matrix_local.inverted()@bone.matrix_local if parent else bone.matrix_local.copy()
            absolute[bone.name]=matrix
            pb=self.rig.pose.bones[bone.name]
            kw={'parent_matrix':absolute[parent.name],'parent_matrix_local':parent.matrix_local} if parent else {}
            pb.rotation_mode='QUATERNION'
            pb.matrix_basis=bone.convert_local_to_pose(matrix,bone.matrix_local,invert=True,**kw)
        return {'joints':points,'hands':hands,'hip':hip,'pitch':pitch,'support':support,'u':u,'emphasis':.30+.68*max(0,sine*(-1 if spec.get('effortPhase')=='return' else 1)),'projection':max(self.errors or [0]),'projectionDetails':self.details,'transforms':absolute}

    def segment(self,out,side,first,last,names,start,end):
        a=self.bones[f'{first}.{side}'].head_local; b=self.bones[f'{last}.{side}'].head_local
        rot=(b-a).rotation_difference(end-start)
        for name in names:
            bone=self.bones[f'{name}.{side}']
            head=start+rot@(bone.head_local-a)
            out[bone.name]=Matrix.Translation(head)@rot.to_matrix().to_4x4()@bone.matrix_local.to_3x3().to_4x4()

    def hand(self,out,side,wrist,direction,axis,normal,closed):
        import build_refined as ref
        bones=self.bones; sign=1 if side=='L' else -1
        rest=bones[f'wrist.{side}'].head_local
        longitudinal=(bones[f'finger3-1.{side}'].head_local-rest).normalized()
        across=(bones[f'finger5-1.{side}'].head_local-bones[f'finger2-1.{side}'].head_local).normalized()*sign
        across=(across-longitudinal*across.dot(longitudinal)).normalized()
        basis=Matrix((across,longitudinal,across.cross(longitudinal))).transposed()
        rotation=(Matrix((axis,direction,normal)).transposed()@basis.transposed()).to_quaternion()
        bone=bones[f'wrist.{side}']; out[bone.name]=ref.world_transform(bone,rotation,wrist)
        grip=wrist+direction*.078-normal*.013
        if not closed: return grip
        for finger in range(1,6):
            chain=[bones[f'finger{finger}-{j}.{side}'] for j in range(1,4)]
            points=[wrist+rotation@(b.head_local-rest) for b in chain]
            points.append(wrist+rotation@(chain[-1].tail_local-rest))
            if finger==1: target=grip+normal*.012-axis*sign*.014
            else:
                accumulated=rotation.copy(); points=[points[0]]
                for j,b in enumerate(chain):
                    accumulated=Quaternion(axis,-[1.,1.25,.9][j])@accumulated
                    points.append(points[-1]+accumulated@(b.tail_local-b.head_local))
                along=(points[0]-grip).dot(axis)
                target=grip+axis*along-direction*.012+normal*.020
            points=ref.solve_chain(points,target)
            for j,b in enumerate(chain):
                original=rotation@(b.tail_local-b.head_local)
                q=original.rotation_difference(points[j+1]-points[j])@rotation
                out[b.name]=ref.world_transform(b,q,points[j])
        return grip
