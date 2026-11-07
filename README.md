# Dispatch — scheduling simulator

A CPU scheduling simulator that shows how four algorithms decide which process runs next.

**[Launch the live simulator](https://bigbubbatx.github.io/dispatch-scheduler/)**. It runs directly in your browser, with no download or Python installation required.

## How to use

1. Choose a scheduling algorithm. For Round Robin, set the time quantum, which is the maximum number of ticks a process can run per turn.
2. Edit the sample processes or click **Generate** to create a workload. **Arrival** is the tick when a process enters the simulation, and **Burst** is the total number of CPU ticks it needs.
3. Click **Load workload** to apply your changes. Click **Step** to advance one tick or **Play** to watch the simulation run. The speed control changes playback pacing.
4. Watch the ready queue, CPU, and timeline to see which process runs next. The metrics show CPU utilization and average waiting and turnaround times for completed processes.

Use **Inject process** to add a process at the current tick, even after the workload finishes. Use **Reset** to replay the last loaded workload without the injected processes. To compare algorithms, select a different one and click **Load workload** again with the same process inputs.

## Run locally

Clone the repo or choose **Code → Download ZIP** on GitHub and extract it. Open
`docs/index.html` in your browser. If you have Python 3, you can also run
`python server.py` from the project folder and open [localhost](http://127.0.0.1:8000).
On Windows, double-clicking `start_ui.bat` starts the same development server.

## Scheduling

- **Round Robin** gives each process up to one time quantum. Arrivals at a
  quantum boundary enter before the expired process is requeued.
- **First In, First Out (FIFO)** runs each process to completion in arrival order.
- **Shortest Job First (SJF)** runs the ready process with the smallest burst
  to completion.
- **Shortest Remaining Time First (SRTF)** selects the ready process with the
  least work remaining. An equal remaining time lets the current process continue.

All four schedulers advance one tick at a time, including idle intervals.
SJF and SRTF break ties in the ready queue by arrival time, then queue order.
Use fresh Process objects with positive integer bursts and nonnegative integer arrivals.
Processes model CPU bursts only, without I/O blocking or context-switch overhead.

The original `fifo()` and `round_robin()` helpers run to completion.
Run `python main.py` for the round robin tests.
The development server binds to 127.0.0.1 for local use.
