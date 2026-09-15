import { splitHouseRest } from '@bombfarm/domain/model';

export function formatHouseRest(totalSeconds: number): string {
  const { minutes, seconds } = splitHouseRest(totalSeconds);
  return `${minutes} min ${seconds} s`;
}
