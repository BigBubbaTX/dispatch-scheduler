from process import Process
from scheduler import round_robin


def run_test(name, inputs, expected):
    processes = [Process(*values) for values in inputs]
    round_robin(processes)

    # Expected: (start, end, waiting, turnaround, response)
    for p in processes:
        actual = (
            p.start_time,
            p.end_time,
            p.waiting_time,
            p.turnaround_time,
            p.response_time,
        )

        assert actual == expected[p.pid], (
            f"{name}, process {p.pid}: "
            f"expected {expected[p.pid]}, got {actual}"
        )
        assert p.remaining_time == 0

    print(f"PASS: {name}")


run_test(
    "Original example",
    [(1, 0, 5), (2, 2, 3), (3, 10, 2)],
    {
        1: (0, 8, 3, 8, 0),
        2: (2, 7, 2, 5, 0),
        3: (10, 12, 0, 2, 0),
    },
)

run_test(
    "Single process arriving later",
    [(1, 5, 3)],
    {
        1: (5, 8, 0, 3, 0),
    },
)

run_test(
    "Idle gap between processes",
    [(1, 0, 1), (2, 5, 1)],
    {
        1: (0, 1, 0, 1, 0),
        2: (5, 6, 0, 1, 0),
    },
)

run_test(
    "Same arrival time, alternating turns",
    [(1, 0, 3), (2, 0, 3)],
    {
        1: (0, 5, 2, 5, 0),
        2: (2, 6, 3, 6, 2),
    },
)

run_test(
    "Unsorted arrivals during a quantum",
    [(1, 0, 4), (2, 2, 1), (3, 1, 1)],
    {
        1: (0, 6, 2, 6, 0),
        2: (3, 4, 1, 2, 1),
        3: (2, 3, 1, 2, 1),
    },
)

round_robin([])
print("PASS: Empty input")