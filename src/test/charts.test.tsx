import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ColumnChart, dayPoints, hourPoints } from "@/components/lh/charts";

afterEach(cleanup);

describe("charts", () => {
  it("labels days and hours in plain words", () => {
    expect(dayPoints([{ day: "2026-10-17", n: 3 }])[0]).toEqual({ label: "17", long: "Sat 17 Oct", n: 3 });
    expect(hourPoints([{ hour: 0, n: 1 }, { hour: 13, n: 2 }]).map((p) => p.long)).toEqual(["12am–1am", "1pm–2pm"]);
  });
  it("shows the value of a tapped bar and offers a table", () => {
    render(<ColumnChart title="Entries per day" points={[{ label: "1", long: "Mon 1 Oct", n: 2 }, { label: "2", long: "Tue 2 Oct", n: 5 }]} />);
    expect(screen.getByText(/Total 7 entries/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }));
    expect(screen.getByRole("table")).toHaveTextContent("Tue 2 Oct5");
  });
});
