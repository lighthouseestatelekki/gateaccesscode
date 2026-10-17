import { describe, expect, it } from "vitest";
import { describeSchedule, fromRow, time12 } from "@/lib/schedule";
import { scheduleProblem } from "@/components/lh/ScheduleEditor";

describe("staff schedules", () => {
  it("describes common schedules in plain words", () => {
    expect(describeSchedule({ days: null, start: null, end: null, dom: null })).toBe("Any day · any time");
    expect(describeSchedule({ days: [1, 2, 3, 4, 5], start: "07:00", end: "18:00", dom: null })).toBe("Mon–Fri · 7:00 AM – 6:00 PM");
    expect(describeSchedule({ days: [6, 0], start: null, end: null, dom: null })).toBe("Weekends · any time");
    expect(describeSchedule({ days: [1, 3, 5], start: "20:00", end: "06:00", dom: null })).toBe("Mon, Wed, Fri · 8:00 PM – 6:00 AM");
    expect(describeSchedule({ days: [1, 2, 3, 5], start: null, end: null, dom: [15, 1] })).toBe("Mon–Wed, Fri · on the 1, 15 of the month · any time");
  });
  it("reads database rows", () => {
    expect(fromRow({ days_of_week: [1], start_time: "08:00:00", end_time: "17:30:00", days_of_month: null })).toEqual({ days: [1], start: "08:00", end: "17:30", dom: null });
    expect(time12("00:05")).toBe("12:05 AM");
  });
  it("catches incomplete schedules before saving", () => {
    expect(scheduleProblem({ days: [], start: null, end: null, dom: null })).toMatch(/working day/);
    expect(scheduleProblem({ days: null, start: "08:00", end: null, dom: null })).toMatch(/both/);
    expect(scheduleProblem({ days: [1], start: "08:00", end: "08:00", dom: null })).toMatch(/same/);
    expect(scheduleProblem({ days: [1], start: null, end: null, dom: [] })).toMatch(/date of the month/);
    expect(scheduleProblem({ days: [1], start: "08:00", end: "17:00", dom: null })).toBe("");
  });
});

import { DEFAULT_SCHEDULE, PRESETS } from "@/components/lh/ScheduleEditor";
import { defaultExpiry } from "@/components/lh/ExpiryOptions";

describe("smart defaults", () => {
  it("new staff start on weekdays, 7am to 6pm, which saves without changes", () => {
    expect(DEFAULT_SCHEDULE).toEqual({ days: [1, 2, 3, 4, 5], start: "07:00", end: "18:00", dom: null });
    expect(scheduleProblem(DEFAULT_SCHEDULE)).toBe("");
    expect(PRESETS.map((p) => p.label)).toEqual(["Mon–Fri", "Mon–Sat", "Any time", "Custom"]);
  });
  it("visitor codes default to today, or tomorrow late in the evening (Lagos time)", () => {
    expect(defaultExpiry(new Date("2026-10-17T10:00:00Z"))).toBe("Today");
    expect(defaultExpiry(new Date("2026-10-17T18:59:00Z"))).toBe("Today");
    expect(defaultExpiry(new Date("2026-10-17T19:00:00Z"))).toBe("Tomorrow");
  });
});
