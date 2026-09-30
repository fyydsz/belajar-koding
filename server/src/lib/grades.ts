export interface AcademicScores {
  tugas: number;
  quiz: number;
  uts: number;
  uas: number;
}

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface GradeResult {
  finalScore: number;
  gradeLetter: GradeLetter;
  gradePoint: number;
  predicate: string;
  isPassing: boolean;
}

/**
 * Validasi nilai agar berada di rentang 0 sampai 100.
 */
export function validateScore(score: number): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 100;
}

/**
 * Menghitung nilai akhir SIAKAD dengan bobot:
 * - Tugas: 20%
 * - Quiz: 20%
 * - UTS: 30%
 * - UAS: 30%
 */
export function calculateFinalScore(scores: AcademicScores): number {
  if (
    !validateScore(scores.tugas) ||
    !validateScore(scores.quiz) ||
    !validateScore(scores.uts) ||
    !validateScore(scores.uas)
  ) {
    throw new Error('Nilai harus berupa angka valid antara 0 sampai 100');
  }

  const finalScore =
    scores.tugas * 0.2 +
    scores.quiz * 0.2 +
    scores.uts * 0.3 +
    scores.uas * 0.3;

  // Dibulatkan 2 desimal
  return Math.round(finalScore * 100) / 100;
}

/**
 * Menentukan huruf mutu, bobot IPK, dan predikat kelulusan berdasarkan nilai akhir.
 */
export function getGradeLetter(score: number): {
  letter: GradeLetter;
  point: number;
  predicate: string;
  isPassing: boolean;
} {
  if (!validateScore(score)) {
    throw new Error('Nilai harus berupa angka valid antara 0 sampai 100');
  }

  if (score >= 85) {
    return { letter: 'A', point: 4.0, predicate: 'Sangat Baik', isPassing: true };
  } else if (score >= 75) {
    return { letter: 'B', point: 3.0, predicate: 'Baik', isPassing: true };
  } else if (score >= 65) {
    return { letter: 'C', point: 2.0, predicate: 'Cukup', isPassing: true };
  } else if (score >= 50) {
    return { letter: 'D', point: 1.0, predicate: 'Kurang', isPassing: false };
  } else {
    return { letter: 'E', point: 0.0, predicate: 'Gagal', isPassing: false };
  }
}

/**
 * Evaluasi lengkap nilai SIAKAD siswa.
 */
export function evaluateStudentGrades(scores: AcademicScores): GradeResult {
  const finalScore = calculateFinalScore(scores);
  const gradeInfo = getGradeLetter(finalScore);

  return {
    finalScore,
    gradeLetter: gradeInfo.letter,
    gradePoint: gradeInfo.point,
    predicate: gradeInfo.predicate,
    isPassing: gradeInfo.isPassing,
  };
}
