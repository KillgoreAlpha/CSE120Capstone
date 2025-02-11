active_sessions = {}

class Session:
    def __init__(self, uid):
        self.time_to_live = 10
        self.user_id = uid

def AddSession(sid, session):
    if active_sessions[sid] == None:
        return -1
    active_sessions[sid] = session

def RemoveSession(sid):
    active_sessions.remove(sid)