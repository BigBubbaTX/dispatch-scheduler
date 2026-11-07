# Dispatch — scheduling simulator

Local web UI powered by the Python scheduling engine. No packages to install.

## Run

With Python 3 installed, run `python server.py` from this folder and open
[the simulator](http://127.0.0.1:8000). On Windows, you can also double-click
`start_ui.bat`. Keep the terminal running and stop the server with Ctrl+C.

## Use

Choose a scheduler, edit arrivals and CPU bursts, then click **Load workload**.
Use **Step** for one tick or **Play** for timed playback. Playback speed changes
animation pacing, never scheduling results. Configuration edits apply only when loaded.
**Reset** restores the loaded workload, removing live additions.
**Inject process** adds a fresh process at the current clock time, even after completion.
Generate mixed, short, or long CPU bursts with the workload controls.
The CPU panel and table show the state at the current tick boundary. The timeline
shows which process ran during each interval.
The timeline displays the most recent 500 ticks. Averages include completed processes.

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
