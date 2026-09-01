/* ---------------------------------------------------------------------------
   The fake school.

   Every number on this site originates here. Attendance is simulated one
   student-day at a time - each student carries a personal absence propensity,
   which is then pushed around by the day (Mondays, Fridays, the day before a
   break) and by grade level. Those draws are folded into three tables:

     attendance  one row per instructional day / grade   (~1,080 rows)
     absences    the same, split by reason               (sparse)
     students    one row per student, plus a sparkline

   Individual student-days are never kept, which puts ~150,000 simulated draws
   under a tenth of a second and a few hundred KB.

   Names are synthetic and deliberately shown as first name + last initial,
   the way a real roster export would be de-identified before it left the SIS.
   --------------------------------------------------------------------------- */

import { createRandom } from "./random.js";
import { buildCalendar, dayPressure, semesterOf, TERM_START, TERM_END } from "./calendar.js";

export const SEED = 20260901;
export const STUDENT_COUNT = 872;
export const SPARK_BUCKETS = 10;

/** Average Daily Attendance funding, per student per day present. */
export const ADA_RATE = 46.5;

export const GRADES = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

export const REASONS = ["Excused", "Unexcused", "Medical", "Family", "Activity", "Suspension"];
const REASON_WEIGHTS = [0.30, 0.26, 0.20, 0.12, 0.08, 0.04];

/** Older students miss more school. This is the single most reliable pattern in the data. */
const GRADE_PRESSURE = {
  "Grade 7": 0.80,
  "Grade 8": 0.88,
  "Grade 9": 1.02,
  "Grade 10": 1.06,
  "Grade 11": 1.14,
  "Grade 12": 1.38
};

const FIRST_NAMES = [
  "Avery", "Jordan", "Maya", "Elias", "Nora", "Diego", "Priya", "Owen",
  "Leila", "Marcus", "Ines", "Theo", "Amara", "Silas", "Ruth", "Kai",
  "Lucia", "Emmett", "Zara", "Hugo", "Camille", "Noah", "Imani", "Felix",
  "Sana", "Rowan", "Talia", "Ezra", "Nadia", "Miles", "Freya", "Andre",
  "Yuki", "Bea", "Omar", "Junie", "Levi", "Anya", "Cyrus", "Delia"
];

const INITIALS = "ABCDEFGHIJKLMNOPRSTVWZ".split("");

const round2 = (value) => Math.round(value * 100) / 100;

/** The federal definition: missing 10% or more of enrolled days. */
export function standingFor(rate) {
  if (rate >= 96) return "Good standing";
  if (rate >= 93) return "Watch";
  if (rate >= 90) return "At risk";
  return "Chronically absent";
}

export const STANDINGS = ["Good standing", "Watch", "At risk", "Chronically absent"];

function buildStudents(random, calendar) {
  const students = [];
  const perGrade = Math.floor(STUDENT_COUNT / GRADES.length);

  for (let i = 0; i < STUDENT_COUNT; i++) {
    // Names repeat, the way they do in a real school of this size. The student
    // ID is the identifier; the name only makes the roster readable.
    const name = `${random.pick(FIRST_NAMES)} ${random.pick(INITIALS)}.`;

    const grade = GRADES[Math.min(GRADES.length - 1, Math.floor(i / perGrade))];

    // Log-normal propensity: most students miss a few days, a long tail misses many.
    const proneness = Math.min(0.32, Math.exp(-3.4 + random.normal() * 0.68));

    // Most students are enrolled all year; a few arrive late or withdraw early.
    let startIndex = 0;
    let endIndex = calendar.length - 1;
    const churn = random();
    if (churn < 0.045) startIndex = random.int(1, Math.floor(calendar.length * 0.6));
    else if (churn < 0.075) endIndex = random.int(Math.floor(calendar.length * 0.4), calendar.length - 1);

    students.push({
      id: 10_000 + i * 7 + random.int(0, 6),
      name,
      grade,
      proneness,
      startIndex,
      endIndex,
      days: 0,
      present: 0,
      absent: 0,
      tardy: 0,
      unexcused: 0,
      lastAbsence: null,
      reasonCounts: {},
      sparkPresent: new Array(SPARK_BUCKETS).fill(0),
      sparkDays: new Array(SPARK_BUCKETS).fill(0)
    });
  }

  return students;
}

export function generateSchool() {
  const startedAt = performance.now();
  const random = createRandom(SEED);
  const calendar = buildCalendar();
  const students = buildStudents(random, calendar);
  const bucketSize = Math.ceil(calendar.length / SPARK_BUCKETS);

  const attendance = [];
  const absenceMap = new Map();
  let studentDays = 0;

  for (let dayIndex = 0; dayIndex < calendar.length; dayIndex++) {
    const date = calendar[dayIndex];
    const pressure = dayPressure(date, dayIndex, calendar);
    const bucket = Math.min(SPARK_BUCKETS - 1, Math.floor(dayIndex / bucketSize));

    // One accumulator per grade for this day.
    const perGrade = new Map(GRADES.map((grade) => [grade, { en: 0, pr: 0, ab: 0, td: 0 }]));

    for (const student of students) {
      if (dayIndex < student.startIndex || dayIndex > student.endIndex) continue;

      const row = perGrade.get(student.grade);
      row.en++;
      student.days++;
      student.sparkDays[bucket]++;
      studentDays++;

      const absenceChance = Math.min(0.92, student.proneness * pressure * GRADE_PRESSURE[student.grade]);

      if (random() < absenceChance) {
        row.ab++;
        student.absent++;
        student.lastAbsence = date;

        const reason = random.weighted(REASONS, REASON_WEIGHTS);
        student.reasonCounts[reason] = (student.reasonCounts[reason] || 0) + 1;
        if (reason === "Unexcused") student.unexcused++;

        const key = `${date}|${student.grade}|${reason}`;
        absenceMap.set(key, (absenceMap.get(key) || 0) + 1);
      } else {
        row.pr++;
        student.present++;
        student.sparkPresent[bucket]++;

        // Tardies track the same underlying propensity, but at a lower rate.
        if (random() < student.proneness * 0.55 + 0.015) {
          row.td++;
          student.tardy++;
        }
      }
    }

    for (const [grade, row] of perGrade) {
      if (row.en === 0) continue;
      attendance.push({ d: date, g: grade, en: row.en, pr: row.pr, ab: row.ab, td: row.td });
    }
  }

  const absences = [...absenceMap.entries()]
    .map(([key, n]) => {
      const [d, g, r] = key.split("|");
      return { d, g, r, n };
    })
    .sort((a, b) => a.d.localeCompare(b.d) || a.g.localeCompare(b.g) || a.r.localeCompare(b.r));

  const studentRows = students
    .filter((student) => student.days > 0)
    .map((student) => {
      const rate = (student.present / student.days) * 100;
      const reasons = Object.entries(student.reasonCounts).sort((a, b) => b[1] - a[1]);

      return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        days: student.days,
        present: student.present,
        absent: student.absent,
        tardy: student.tardy,
        unexcused: student.unexcused,
        rate: round2(rate),
        standing: standingFor(rate),
        topReason: reasons.length ? reasons[0][0] : "-",
        lastAbsence: student.lastAbsence,
        spark: student.sparkPresent.map((present, i) =>
          (student.sparkDays[i] ? round2((present / student.sparkDays[i]) * 100) : null))
      };
    })
    .sort((a, b) => a.rate - b.rate);

  const chronic = studentRows.filter((s) => s.standing === "Chronically absent").length;

  return {
    meta: {
      seed: SEED,
      school: "Harbor Point High School",
      district: "Westbrook Unified School District",
      termStart: TERM_START,
      termEnd: TERM_END,
      instructionalDays: calendar.length,
      grades: GRADES,
      reasons: REASONS,
      students: studentRows.length,
      studentDays,
      chronicallyAbsent: chronic,
      adaRate: ADA_RATE,
      generatedInMs: Math.round(performance.now() - startedAt),
      notice: "Synthetic data generated in your browser from a fixed seed. No real students, staff, or schools are represented."
    },
    calendar,
    attendance,
    absences,
    students: studentRows,
    semesterOf
  };
}
