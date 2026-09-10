import { describe, it, expect } from "vitest";
import {
  dueSlots, assessFreshness, freshnessThresholdMinutes, istClock, classifyBackupKey,
  describeNextNightly, clampBackupHour, normaliseIntradayEvery,
} from "./backup-schedule";

/** Build an instant from an IST wall-clock reading (IST = UTC+05:30, no DST). */
const ist = (date: string, hh: number, mm: number) => new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);

const nightlyOnly = { backupHour: 2, intradayEveryHours: 0 };
const hourly      = { backupHour: 2, intradayEveryHours: 1 };

describe("istClock", () => {
  it("reads the Asia/Kolkata wall clock, including across the UTC midnight boundary", () => {
    /* 23:45 UTC on the 9th is 05:15 IST on the 10th. */
    expect(istClock(new Date("2026-09-09T23:45:00Z"))).toEqual({ date: "2026-09-10", hour: 5, minute: 15 });
    /* Midnight IST is hour 0, never 24. */
    expect(istClock(ist("2026-09-10", 0, 0))).toEqual({ date: "2026-09-10", hour: 0, minute: 0 });
  });
});

describe("dueSlots — nightly", () => {
  it("is not due before HH:30", () => {
    expect(dueSlots(ist("2026-09-10", 2, 29), nightlyOnly)).toEqual([]);
  });

  it("becomes due at HH:30 and STAYS due for the rest of the IST day (catch-up)", () => {
    expect(dueSlots(ist("2026-09-10", 2, 30), nightlyOnly)).toEqual([{ slot: "nightly:2026-09-10", kind: "nightly" }]);
    expect(dueSlots(ist("2026-09-10", 23, 59), nightlyOnly)).toEqual([{ slot: "nightly:2026-09-10", kind: "nightly" }]);
  });

  it("rolls to a new slot name at IST midnight", () => {
    expect(dueSlots(ist("2026-09-11", 0, 5), nightlyOnly)).toEqual([]);
    expect(dueSlots(ist("2026-09-11", 2, 30), nightlyOnly)[0]!.slot).toBe("nightly:2026-09-11");
  });

  it("honours the grace period so the deployment claims first", () => {
    expect(dueSlots(ist("2026-09-10", 2, 32), nightlyOnly, 3)).toEqual([]);
    expect(dueSlots(ist("2026-09-10", 2, 33), nightlyOnly, 3)).toHaveLength(1);
  });

  it("clamps grace under 30 minutes so a slot cannot slide past midnight", () => {
    const late = { backupHour: 23, intradayEveryHours: 0 };
    expect(dueSlots(ist("2026-09-10", 23, 59), late, 600)).toEqual([{ slot: "nightly:2026-09-10", kind: "nightly" }]);
  });
});

describe("dueSlots — intraday", () => {
  it("offers only the CURRENT boundary, never a backlog", () => {
    const due = dueSlots(ist("2026-09-10", 9, 15), hourly);
    expect(due).toEqual([
      { slot: "nightly:2026-09-10", kind: "nightly" },
      { slot: "intraday:2026-09-10T09", kind: "intraday" },
    ]);
  });

  it("skips the boundary the nightly already covers", () => {
    expect(dueSlots(ist("2026-09-10", 2, 45), hourly)).toEqual([{ slot: "nightly:2026-09-10", kind: "nightly" }]);
  });

  it("aligns multi-hour intervals to the top of the day", () => {
    const every4 = { backupHour: 2, intradayEveryHours: 4 };
    expect(dueSlots(ist("2026-09-10", 13, 0), every4).map((d) => d.slot)).toContain("intraday:2026-09-10T12");
    expect(dueSlots(ist("2026-09-10", 1, 0), every4)).toEqual([{ slot: "intraday:2026-09-10T00", kind: "intraday" }]);
  });

  it("is off at 0", () => {
    expect(dueSlots(ist("2026-09-10", 9, 15), nightlyOnly)).toHaveLength(1);
  });

  it("applies the grace period to intraday boundaries too", () => {
    expect(dueSlots(ist("2026-09-10", 9, 2), hourly, 3).map((d) => d.kind)).toEqual(["nightly"]);
    expect(dueSlots(ist("2026-09-10", 9, 3), hourly, 3).map((d) => d.kind)).toEqual(["nightly", "intraday"]);
  });
});

describe("freshness", () => {
  it("nightly-only tolerates a day plus two hours; hourly tolerates two missed runs", () => {
    expect(freshnessThresholdMinutes(nightlyOnly)).toBe(26 * 60);
    expect(freshnessThresholdMinutes(hourly)).toBe(150);
  });

  it("is unknown (never alerting) when nothing has ever been attempted", () => {
    expect(assessFreshness(null, nightlyOnly).state).toBe("unknown");
    expect(assessFreshness(null, nightlyOnly, new Date(), null).ageMinutes).toBeNull();
  });

  it("goes stale when the first attempt is older than the threshold and nothing ever succeeded", () => {
    const firstAttempt = new Date("2026-09-10T00:00:00Z");
    const soon  = new Date(firstAttempt.getTime() + 150 * 60_000);
    const later = new Date(firstAttempt.getTime() + 151 * 60_000);
    expect(assessFreshness(null, hourly, soon, firstAttempt).state).toBe("unknown");
    const stale = assessFreshness(null, hourly, later, firstAttempt);
    expect(stale.state).toBe("stale");
    expect(stale.ageMinutes).toBe(151);
    expect(stale.lastSuccessAt).toBeNull();
  });

  it("flips from ok to stale exactly past the threshold", () => {
    const finishedAt = new Date("2026-09-10T00:00:00Z");
    const okAt    = new Date(finishedAt.getTime() + 150 * 60_000);
    const staleAt = new Date(finishedAt.getTime() + 151 * 60_000);
    expect(assessFreshness({ finishedAt, kind: "intraday" }, hourly, okAt).state).toBe("ok");
    const stale = assessFreshness({ finishedAt, kind: "intraday" }, hourly, staleAt);
    expect(stale.state).toBe("stale");
    expect(stale.ageMinutes).toBe(151);
    expect(stale.lastSuccessAt).toBe(finishedAt.toISOString());
  });

  it("never reports a negative age when clocks disagree slightly", () => {
    const finishedAt = new Date("2026-09-10T00:01:00Z");
    expect(assessFreshness({ finishedAt, kind: "manual" }, nightlyOnly, new Date("2026-09-10T00:00:00Z")).ageMinutes).toBe(0);
  });
});

describe("helpers", () => {
  it("classifies keys by prefix", () => {
    expect(classifyBackupKey("backups/intraday/x.json.gz.enc")).toBe("intraday");
    expect(classifyBackupKey("backups/x.json.gz")).toBe("nightly");
  });

  it("describes the next nightly on the IST clock", () => {
    expect(describeNextNightly(ist("2026-09-10", 1, 0), nightlyOnly)).toBe("Today 02:30 IST");
    expect(describeNextNightly(ist("2026-09-10", 2, 30), nightlyOnly)).toBe("Tomorrow 02:30 IST");
  });

  it("normalises settings defensively", () => {
    expect(clampBackupHour("7")).toBe(7);
    expect(clampBackupHour(99)).toBe(23);
    expect(clampBackupHour("x", 2)).toBe(2);
    expect(normaliseIntradayEvery(5, 1)).toBe(1);
    expect(normaliseIntradayEvery("6")).toBe(6);
  });
});
