def fifo(processes):
        if not processes:
            return
        processes = processes.copy()
        current_time = 0
        while len(processes) > 0:
            most_recent_arrival = processes[0].arrival_time
            cur_proc = processes[0]
            for process in processes:
                if most_recent_arrival > process.arrival_time:
                    most_recent_arrival = process.arrival_time
                    cur_proc = process

            if current_time >= cur_proc.arrival_time:
                cur_proc.start_time = current_time
                while cur_proc.remaining_time != 0:

                    cur_proc.remaining_time -= 1
                    current_time += 1
                cur_proc.end_time = current_time
                cur_proc.waiting_time = cur_proc.start_time - cur_proc.arrival_time
                cur_proc.turnaround_time = cur_proc.end_time - cur_proc.arrival_time
                cur_proc.response_time = cur_proc.waiting_time
                processes.remove(cur_proc)
            else:
                current_time += 1
        return current_time



class RoundRobin:
    def __init__(self, processes, time_quantum=2):
        if type(time_quantum) is not int or time_quantum <= 0:
            raise ValueError("Time quantum must be a positive integer")
        self.processes = []
        self.all_processes = []
        self.current_time = 0
        self.time_quantum = time_quantum
        self.runnable_processes = []
        self.current_process = None
        self.quantum_used = 0
        self.history = []
        for process in processes:
            self.add_process(process)
        self.enqueue_arrivals()

    @property
    def finished(self):
        return not self.processes

    def add_process(self, process):
        if type(process.arrival_time) is not int or process.arrival_time < self.current_time:
            raise ValueError("Arrival must be an integer at or after the current time")
        if type(process.burst_time) is not int or process.burst_time <= 0:
            raise ValueError("Burst must be a positive integer")
        if any(p.pid == process.pid for p in self.all_processes):
            raise ValueError("Process IDs must be unique")
        if process.remaining_time != process.burst_time or process.start_time is not None:
            raise ValueError("Use fresh process objects for each simulation")
        self.processes.append(process)
        self.all_processes.append(process)

    def enqueue_arrivals(self):
        for process in self.processes:
            if (process.arrival_time <= self.current_time
                    and process is not self.current_process
                    and process not in self.runnable_processes):
                self.runnable_processes.append(process)

    def _select_next(self):
        if self.current_process is None and self.runnable_processes:
            return self.runnable_processes.pop(0)
        return self.current_process

    def tick(self):
        if self.finished:
            return
        self.enqueue_arrivals()
        next_process = self._select_next()
        if next_process is not self.current_process:
            self.current_process = next_process
            self.quantum_used = 0
            if self.current_process.start_time is None:
                self.current_process.start_time = self.current_time

        self.history.append(self.current_process.pid if self.current_process else None)
        self.current_time += 1
        if self.current_process is not None:
            self.current_process.remaining_time -= 1
            self.quantum_used += 1
        self.enqueue_arrivals()
        if self.current_process is None:
            return

        process = self.current_process
        if process.remaining_time == 0:
            process.end_time = self.current_time
            process.finish_time = self.current_time
            process.turnaround_time = process.end_time - process.arrival_time
            process.waiting_time = process.turnaround_time - process.burst_time
            process.response_time = process.start_time - process.arrival_time
            self.processes.remove(process)
            self.current_process = None
            self.quantum_used = 0
        elif self.time_quantum is not None and self.quantum_used == self.time_quantum:
            self.runnable_processes.append(process)
            self.current_process = None
            self.quantum_used = 0


class FIFO(RoundRobin):
    """Same tick engine, with no quantum expiration (non-preemptive)."""
    def __init__(self, processes):
        super().__init__(processes)
        self.time_quantum = None


class ShortestJobFirst(FIFO):
    """Run the shortest available job to completion."""

    def enqueue_arrivals(self):
        super().enqueue_arrivals()
        self.runnable_processes.sort(key=self._ready_order)

    def _ready_order(self, process):
        return process.burst_time, process.arrival_time


class ShortestRemainingTimeFirst(ShortestJobFirst):
    """Switch jobs when a ready job has strictly less work remaining."""

    def _ready_order(self, process):
        return process.remaining_time, process.arrival_time

    def _select_next(self):
        current = self.current_process
        if current is not None and self.runnable_processes:
            candidate = self.runnable_processes[0]
            if candidate.remaining_time < current.remaining_time:
                self.runnable_processes[0] = current
                self.runnable_processes.sort(key=self._ready_order)
                return candidate
        return super()._select_next()


def round_robin(processes, time_quantum=2):
    """Compatibility helper for scripts that run the entire simulation."""
    sim = RoundRobin(processes, time_quantum)
    while not sim.finished:
        sim.tick()
    return sim.current_time
