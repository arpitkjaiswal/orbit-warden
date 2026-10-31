from collections import deque, Counter
import os

class Gestures:
    def __init__(self):
        self.active=False
        self.ready=False
        self.camera=None
        self.history=deque(maxlen=7)
        self.x=.5
        self.label='none'
        self.model=None
        try:
            import cv2
            import mediapipe as mp
            self.cv2=cv2
            self.mp=mp
            if hasattr(mp,'solutions'):
                self.detector=mp.solutions.hands.Hands(max_num_hands=1,min_detection_confidence=.65)
                self.legacy=True
            else:
                from mediapipe.tasks.python import vision, BaseOptions
                path=os.environ.get('ORBIT_HAND_LANDMARKER','hand_landmarker.task')
                if not os.path.isfile(path):
                    return
                self.detector=vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=path),running_mode=vision.RunningMode.IMAGE,num_hands=1))
                self.legacy=False
            model_path=os.environ.get('ORBIT_GESTURE_MODEL')
            if model_path:
                import joblib
                self.model=joblib.load(model_path)
            self.ready=True
        except (ImportError, OSError, ValueError, AttributeError):
            pass
    def toggle(self):
        if not self.ready:return
        if self.active:
            self.camera.release()
            self.camera=None
            self.active=False
        else:
            self.camera=self.cv2.VideoCapture(0)
            self.active=self.camera.isOpened()
            if not self.active:self.camera.release()
    def update(self):
        if not self.active:return self.label,self.x
        ok,frame=self.camera.read()
        if not ok:return self.label,self.x
        frame=self.cv2.cvtColor(self.cv2.flip(frame,1),self.cv2.COLOR_BGR2RGB)
        if self.legacy:
            result=self.detector.process(frame)
            points=result.multi_hand_landmarks[0].landmark if result.multi_hand_landmarks else None
        else:
            result=self.detector.detect(self.mp.Image(image_format=self.mp.ImageFormat.SRGB,data=frame))
            points=result.hand_landmarks[0] if result.hand_landmarks else None
        if points:
            self.x=.7*self.x+.3*points[9].x
            if self.model:
                features=[v for p in points for v in (p.x,p.y,p.z)]
                label=str(self.model.predict([features])[0]).lower()
                if label not in ('move','fire','shield','recharge','none'):label='none'
            else:
                fingers=[points[t].y<points[p].y for t,p in ((8,6),(12,10),(16,14),(20,18))]
                label='shield' if not any(fingers) else 'recharge' if all(fingers) else 'fire' if fingers==[True,False,False,False] else 'move'
        else:label='none'
        self.history.append(label)
        self.label=Counter(self.history).most_common(1)[0][0]
        return self.label,self.x
    def close(self):
        if self.active:self.toggle()
        if self.ready:self.detector.close()
