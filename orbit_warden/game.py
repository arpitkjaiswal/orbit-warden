import math,random
import pygame
from .logic import WIDTH,HEIGHT,Circle,State,collides,difficulty,POINTS
from .gestures import Gestures

NAVY=(7,10,26); CYAN=(52,231,255); RED=(255,80,112); PURPLE=(171,106,255); WHITE=(228,238,255); GOLD=(255,205,95)

class Enemy:
    def __init__(self,kind,level):
        self.kind=kind;self.x=random.uniform(40,WIDTH-40);self.base=self.x;self.y=-35
        self.phase=random.random()*math.tau;self.t=0
        self.radius={'asteroid':21,'drone':18,'zigzag':17,'tank':29}[kind]
        self.hp={'asteroid':1,'drone':2,'zigzag':2,'tank':5}[kind]
        self.speed={'asteroid':100,'drone':125,'zigzag':150,'tank':75}[kind]*level
    def update(self,dt):
        self.t+=dt;self.y+=self.speed*dt
        if self.kind!='asteroid':
            freq,amp={'drone':(2.7,70),'zigzag':(5,105),'tank':(1.2,35)}[self.kind]
            self.x=max(self.radius,min(WIDTH-self.radius,self.base+math.sin(self.t*freq+self.phase)*amp))

class Game:
    def __init__(self):
        pygame.init();self.screen=pygame.display.set_mode((WIDTH,HEIGHT));pygame.display.set_caption('ORBIT WARDEN')
        self.clock=pygame.time.Clock();self.font=pygame.font.SysFont('consolas',19,True)
        self.big=pygame.font.SysFont('consolas',65,True);self.small=pygame.font.SysFont('consolas',14)
        self.stars=[(random.randrange(WIDTH),random.randrange(HEIGHT),random.choice((1,1,2))) for _ in range(130)]
        self.gestures=Gestures();self.reset()
    def reset(self):
        self.state=State();self.x=WIDTH/2;self.enemies=[];self.shots=[];self.particles=[]
        self.spawn=0;self.cooldown=0;self.invulnerable=0;self.shielding=False;self.charging=False;self.paused=False
    def explode(self,x,y,color,count=15):
        for _ in range(count):
            angle=random.random()*math.tau;speed=random.uniform(30,190)
            self.particles.append([x,y,math.cos(angle)*speed,math.sin(angle)*speed,.55,color])
    def fire(self):
        if self.cooldown<=0 and self.state.energy>=8:
            self.shots.append([self.x,HEIGHT-89]);self.state.energy-=8;self.cooldown=.17
    def update(self,dt):
        keys=pygame.key.get_pressed();gesture,gx=self.gestures.update()
        if self.paused or self.state.over:return
        s=self.state;s.time+=dt;self.cooldown=max(0,self.cooldown-dt);self.invulnerable=max(0,self.invulnerable-dt)
        axis=int(bool(keys[pygame.K_RIGHT] or keys[pygame.K_d]))-int(bool(keys[pygame.K_LEFT] or keys[pygame.K_a]))
        if axis:self.x+=axis*380*dt
        elif self.gestures.active and gesture!='none':self.x+=(35+gx*(WIDTH-70)-self.x)*min(1,7*dt)
        self.x=max(35,min(WIDTH-35,self.x))
        self.shielding=bool(keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT] or (self.gestures.active and gesture=='shield')) and s.shield>0
        self.charging=bool(keys[pygame.K_e] or (self.gestures.active and gesture=='recharge')) and not self.shielding
        s.shield=max(0,s.shield-38*dt) if self.shielding else min(100,s.shield+10*dt)
        s.energy=min(100,s.energy+(32 if self.charging else 5)*dt)
        if keys[pygame.K_SPACE] or (self.gestures.active and gesture=='fire'):self.fire()
        self.spawn-=dt
        if self.spawn<=0:
            self.enemies.append(Enemy(random.choice(['asteroid']*5+['drone']*3+['zigzag']*2+['tank']),difficulty(s.time)))
            self.spawn=random.uniform(.35,.85)/difficulty(s.time)
        for e in self.enemies[:]:
            e.update(dt)
            if e.y>HEIGHT+45:self.enemies.remove(e);continue
            if collides(Circle(e.x,e.y,e.radius),Circle(self.x,HEIGHT-65,22)):
                self.enemies.remove(e);self.explode(e.x,e.y,RED)
                if self.shielding:s.shield=max(0,s.shield-16)
                elif self.invulnerable<=0:s.damage();self.invulnerable=.85
                if s.over:self.explode(self.x,HEIGHT-65,RED,50)
        for shot in self.shots[:]:
            shot[1]-=660*dt
            if shot[1]<-20:self.shots.remove(shot);continue
            for e in self.enemies[:]:
                if collides(Circle(shot[0],shot[1],5),Circle(e.x,e.y,e.radius)):
                    self.shots.remove(shot);e.hp-=1;self.explode(shot[0],shot[1],CYAN,5)
                    if e.hp<=0:
                        self.enemies.remove(e);s.award(e.kind);self.explode(e.x,e.y,PURPLE if e.kind!='asteroid' else GOLD,20)
                    break
        for p in self.particles[:]:
            p[0]+=p[2]*dt;p[1]+=p[3]*dt;p[4]-=dt
            if p[4]<=0:self.particles.remove(p)
    def bar(self,x,label,value,color):
        self.screen.blit(self.small.render(label,True,WHITE),(x,9))
        pygame.draw.rect(self.screen,(39,46,73),(x,32,140,10),border_radius=4)
        pygame.draw.rect(self.screen,color,(x,32,int(140*max(0,value)/100),10),border_radius=4)
    def draw(self):
        sc=self.screen;sc.fill(NAVY)
        for x,y,r in self.stars:pygame.draw.circle(sc,(50+r*20,65+r*20,100+r*20),(x,(y+int(self.state.time*15*r))%HEIGHT),r)
        for e in self.enemies:
            x,y=int(e.x),int(e.y)
            if e.kind=='asteroid':
                pygame.draw.circle(sc,(105,113,137),(x,y),e.radius);pygame.draw.circle(sc,(60,66,87),(x-6,y-5),6)
            else:
                color={'drone':RED,'zigzag':PURPLE,'tank':GOLD}[e.kind]
                pygame.draw.polygon(sc,color,[(x,y-e.radius),(x+e.radius,y),(x,y+e.radius),(x-e.radius,y)],3)
                pygame.draw.circle(sc,color,(x,y),6);pygame.draw.line(sc,color,(x-e.radius-8,y),(x+e.radius+8,y),2)
        for x,y in self.shots:pygame.draw.line(sc,CYAN,(int(x),int(y)+12),(int(x),int(y)-14),4)
        x=int(self.x);y=HEIGHT-65
        if self.charging:
            beam=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA)
            pygame.draw.polygon(beam,(30,170,180,38),[(x-17,y-20),(x+17,y-20),(x+90,0),(x-90,0)])
            sc.blit(beam,(0,0));pygame.draw.line(sc,CYAN,(x,y-25),(x,0),2)
        color=WHITE if self.invulnerable<=0 or int(self.state.time*15)%2 else RED
        ship=[(x,y-30),(x-25,y+19),(x,y+9),(x+25,y+19)]
        pygame.draw.polygon(sc,color,ship);pygame.draw.polygon(sc,CYAN,ship,3)
        pygame.draw.polygon(sc,PURPLE,[(x-10,y+20),(x,y+40+random.randint(0,8)),(x+10,y+20)])
        if self.shielding:pygame.draw.circle(sc,CYAN,(x,y),40,3)
        for px,py,vx,vy,life,color in self.particles:pygame.draw.circle(sc,color,(int(px),int(py)),max(1,int(life*5)))
        pygame.draw.rect(sc,(15,22,43),(0,0,WIDTH,78))
        sc.blit(self.font.render('ORBIT // WARDEN',True,CYAN),(16,12))
        sc.blit(self.small.render(f'SCORE {self.state.score:06d}  TIME {self.state.time:.0f}s  LEVEL {difficulty(self.state.time):.1f}x',True,WHITE),(16,47))
        sc.blit(self.font.render('HP '+'♥'*self.state.hp+'♡'*(5-self.state.hp),True,RED),(340,15))
        self.bar(620,'ENERGY',self.state.energy,CYAN);self.bar(790,'SHIELD',self.state.shield,PURPLE)
        status='GESTURE '+self.gestures.label.upper() if self.gestures.active else ('G: ENABLE CAMERA' if self.gestures.ready else 'GESTURES UNAVAILABLE')
        sc.blit(self.small.render(status,True,CYAN),(15,HEIGHT-21))
        sc.blit(self.small.render('ARROWS/A-D MOVE | SPACE FIRE | E RECHARGE | SHIFT SHIELD | P PAUSE | R RESTART',True,(148,165,190)),(280,HEIGHT-21))
        if self.state.over or self.paused:
            layer=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA);layer.fill((2,5,17,215));sc.blit(layer,(0,0))
            label=self.big.render('GAME OVER' if self.state.over else 'PAUSED',True,RED if self.state.over else CYAN)
            sc.blit(label,label.get_rect(center=(WIDTH//2,HEIGHT//2-65)))
            line=self.font.render(f'SCORE {self.state.score}   SURVIVED {self.state.time:.1f}s',True,WHITE)
            sc.blit(line,line.get_rect(center=(WIDTH//2,HEIGHT//2+5)))
            hint=self.font.render('R TO RESTART' if self.state.over else 'P TO RESUME',True,CYAN)
            sc.blit(hint,hint.get_rect(center=(WIDTH//2,HEIGHT//2+50)))
        pygame.display.flip()
    def run(self):
        running=True
        while running:
            dt=min(.05,self.clock.tick(60)/1000)
            for event in pygame.event.get():
                if event.type==pygame.QUIT:running=False
                elif event.type==pygame.KEYDOWN:
                    if event.key==pygame.K_ESCAPE:running=False
                    if event.key==pygame.K_r:self.reset()
                    if event.key==pygame.K_p and not self.state.over:self.paused=not self.paused
                    if event.key==pygame.K_g:self.gestures.toggle()
            self.update(dt);self.draw()
        self.gestures.close();pygame.quit()

def main():Game().run()
