class Process:
    def __init__(self, pid, arrival_time, burst_time):
        self.pid = pid
        self.arrival_time = arrival_time
        self.burst_time = burst_time
        self.remaining_time = burst_time
        self.state = "NEW"
        self.start_time = None
        self.finish_time = None
        self.waiting_time = None
        self.turnaround_time = None
        self.response_time = None