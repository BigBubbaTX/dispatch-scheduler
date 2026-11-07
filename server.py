"""Local UI: run python server.py, then open localhost:8000."""
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from process import Process
from scheduler import FIFO, RoundRobin, ShortestJobFirst, ShortestRemainingTimeFirst

WEB = Path(__file__).parent / "docs"
sessions = {}
lock = threading.Lock()
SCHEDULERS = {
    "rr": RoundRobin,
    "fifo": FIFO,
    "sjf": ShortestJobFirst,
    "srtf": ShortestRemainingTimeFirst,
}


def integer(value, name, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{name} must be an integer from {low} to {high}")
    return value


def snapshot(sim):
    sim.enqueue_arrivals()
    rows = []
    for p in sim.all_processes:
        state = ("completed" if p.remaining_time == 0 else
                 "running" if p is sim.current_process else
                 "ready" if p.arrival_time <= sim.current_time else "new")
        p.state = state.upper()
        rows.append(dict(pid=p.pid, arrival=p.arrival_time, burst=p.burst_time,
                         remaining=p.remaining_time, start=p.start_time,
                         end=getattr(p, "end_time", None), waiting=p.waiting_time,
                         turnaround=p.turnaround_time, response=p.response_time,
                         state=state))
    return dict(time=sim.current_time, finished=sim.finished, processes=rows,
                ready=[p.pid for p in sim.runnable_processes],
                current=sim.current_process.pid if sim.current_process else None,
                quantum_used=sim.quantum_used, history=sim.history)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length < 0 or length > 65536:
                raise ValueError("Request is too large")
            data = json.loads(self.rfile.read(length))
            key = self.headers.get("X-Simulation", "")
            if not key or len(key) > 100:
                raise ValueError("Missing simulation ID")
            with lock:
                if self.path == "/api/reset":
                    algorithm = data.get("algorithm")
                    if not isinstance(algorithm, str) or algorithm not in SCHEDULERS:
                        raise ValueError("Unknown scheduler")
                    values = data.get("processes", [])
                    if not isinstance(values, list) or len(values) > 100:
                        raise ValueError("Use at most 100 processes")
                    processes = []
                    for index, row in enumerate(values, 1):
                        processes.append(Process(index,
                            integer(row.get("arrival"), "Arrival", 0, 10000),
                            integer(row.get("burst"), "Burst", 1, 1000)))
                    if algorithm == "rr":
                        quantum = integer(data.get("quantum"), "Quantum", 1, 100)
                        sim = RoundRobin(processes, quantum)
                    else:
                        sim = SCHEDULERS[algorithm](processes)
                    sessions[key] = sim
                elif self.path in ("/api/tick", "/api/add"):
                    if key not in sessions:
                        raise ValueError("Reset the simulation first")
                    sim = sessions[key]
                    if self.path == "/api/tick":
                        if sim.current_time >= 20000 and not sim.finished:
                            raise ValueError("Simulation limit reached; reset to continue")
                        sim.tick()
                    else:
                        if len(sim.all_processes) >= 100:
                            raise ValueError("Use at most 100 processes")
                        pid = max((p.pid for p in sim.all_processes), default=0) + 1
                        sim.add_process(Process(pid,
                            integer(data.get("arrival"), "Arrival", sim.current_time, 20000),
                            integer(data.get("burst"), "Burst", 1, 1000)))
                else:
                    self.send_error(404)
                    return
                result = snapshot(sim)
            self.reply(200, result)
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            self.reply(400, {"error": str(error)})

    def reply(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("Scheduling simulator: http://127.0.0.1:8000", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
