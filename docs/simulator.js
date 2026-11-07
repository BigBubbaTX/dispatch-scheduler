class Simulation {
  constructor({algorithm, quantum, processes}) {
    if (!['rr', 'fifo', 'sjf', 'srtf'].includes(algorithm)) {
      throw new Error('Unknown scheduler');
    }
    if (!Array.isArray(processes) || processes.length > 100) {
      throw new Error('Use at most 100 processes');
    }
    this.algorithm = algorithm;
    this.quantum = algorithm === 'rr' ? Simulation.integer(quantum, 'Quantum', 1, 100) : null;
    this.time = 0;
    this.quantumUsed = 0;
    this.current = null;
    this.ready = [];
    this.history = [];
    this.processes = processes.map((row, index) => this.makeProcess(row, index + 1, 10000));
  }

  static integer(value, name, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer from ${min} to ${max}`);
    }
    return value;
  }

  makeProcess({arrival, burst}, pid, latestArrival) {
    Simulation.integer(arrival, 'Arrival', this.time, latestArrival);
    Simulation.integer(burst, 'Burst', 1, 1000);
    return {pid, arrival, burst, remaining:burst, start:null, end:null,
      waiting:null, turnaround:null, response:null};
  }

  add(data) {
    if (this.processes.length >= 100) throw new Error('Use at most 100 processes');
    this.processes.push(this.makeProcess(data, this.processes.length + 1, 20000));
  }

  get finished() {
    return this.processes.every(process => process.remaining === 0);
  }

  prioritizeReady() {
    if (this.algorithm === 'sjf' || this.algorithm === 'srtf') {
      const field = this.algorithm === 'sjf' ? 'burst' : 'remaining';
      this.ready.sort((a, b) => a[field] - b[field] || a.arrival - b.arrival);
    }
  }

  enqueueArrivals() {
    for (const process of this.processes) {
      if (process.remaining > 0 && process.arrival <= this.time &&
          process !== this.current && !this.ready.includes(process)) {
        this.ready.push(process);
      }
    }
    this.prioritizeReady();
  }

  tick() {
    if (this.finished) return;
    if (this.time >= 20000) throw new Error('Simulation limit reached; reset to continue');
    this.enqueueArrivals();

    const candidate = this.ready[0];
    if (candidate && (!this.current ||
        (this.algorithm === 'srtf' && candidate.remaining < this.current.remaining))) {
      this.ready.shift();
      if (this.current) {
        this.ready.unshift(this.current);
        this.prioritizeReady();
      }
      this.current = candidate;
      this.current.start ??= this.time;
      this.quantumUsed = 0;
    }

    const process = this.current;
    this.history.push(process?.pid ?? null);
    this.time += 1;
    if (process) {
      process.remaining -= 1;
      this.quantumUsed += 1;
    }
    this.enqueueArrivals();
    if (!process) return;

    if (process.remaining === 0) {
      process.end = this.time;
      process.turnaround = process.end - process.arrival;
      process.waiting = process.turnaround - process.burst;
      process.response = process.start - process.arrival;
    } else if (this.quantumUsed === this.quantum) {
      this.ready.push(process);
    } else {
      return;
    }
    this.current = null;
    this.quantumUsed = 0;
  }

  snapshot() {
    this.enqueueArrivals();
    return {
      time: this.time,
      finished: this.finished,
      processes: this.processes.map(process => ({
        ...process,
        state: process.remaining === 0 ? 'completed' :
          process === this.current ? 'running' :
          process.arrival <= this.time ? 'ready' : 'new'
      })),
      ready: this.ready.map(process => process.pid),
      current: this.current?.pid ?? null,
      quantum_used: this.quantumUsed,
      history: [...this.history]
    };
  }
}
