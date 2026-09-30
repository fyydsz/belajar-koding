import { describe, expect, test } from 'bun:test';
import { calculateFinalScore, getGradeLetter, evaluateStudentGrades, validateScore } from '../src/lib/grades';

describe('SIAKAD Grades Calculation', () => {
  test('validates score range between 0 and 100', () => {
    expect(validateScore(0)).toBe(true);
    expect(validateScore(100)).toBe(true);
    expect(validateScore(85.5)).toBe(true);
    expect(validateScore(-5)).toBe(false);
    expect(validateScore(105)).toBe(false);
    expect(validateScore(NaN)).toBe(false);
  });

  test('calculates final score accurately with weights (20/20/30/30)', () => {
    // 100*0.2 + 100*0.2 + 100*0.3 + 100*0.3 = 100
    const perfect = calculateFinalScore({ tugas: 100, quiz: 100, uts: 100, uas: 100 });
    expect(perfect).toBe(100);

    // 80*0.2 + 90*0.2 + 70*0.3 + 85*0.3 = 16 + 18 + 21 + 25.5 = 80.5
    const mix = calculateFinalScore({ tugas: 80, quiz: 90, uts: 70, uas: 85 });
    expect(mix).toBe(80.5);
  });

  test('throws error on invalid scores in calculation', () => {
    expect(() => calculateFinalScore({ tugas: -1, quiz: 80, uts: 80, uas: 80 })).toThrow();
    expect(() => calculateFinalScore({ tugas: 80, quiz: 110, uts: 80, uas: 80 })).toThrow();
  });

  test('maps score to correct grade letters and passing status', () => {
    expect(getGradeLetter(90).letter).toBe('A');
    expect(getGradeLetter(85).letter).toBe('A');
    expect(getGradeLetter(80).letter).toBe('B');
    expect(getGradeLetter(70).letter).toBe('C');
    expect(getGradeLetter(55).letter).toBe('D');
    expect(getGradeLetter(40).letter).toBe('E');

    expect(getGradeLetter(90).isPassing).toBe(true);
    expect(getGradeLetter(70).isPassing).toBe(true);
    expect(getGradeLetter(55).isPassing).toBe(false);
    expect(getGradeLetter(40).isPassing).toBe(false);
  });

  test('evaluates full academic result', () => {
    const result = evaluateStudentGrades({ tugas: 90, quiz: 85, uts: 88, uas: 92 });
    expect(result.finalScore).toBe(89);
    expect(result.gradeLetter).toBe('A');
    expect(result.gradePoint).toBe(4.0);
    expect(result.isPassing).toBe(true);
  });
});
