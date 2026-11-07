import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitLog, setLogSink, type LogSink } from '@/core/log-sink';

describe('log-sink', () => {
  beforeEach(() => {
    setLogSink(null);
  });

  it('is a no-op when no sink is registered', () => {
    // Should not throw.
    expect(() => emitLog('WARN', '[t] [WARN] x')).not.toThrow();
  });

  it('forwards level and line to the registered sink', () => {
    const received: Array<[string, string]> = [];
    const sink: LogSink = (level, line) => received.push([level, line]);
    setLogSink(sink);

    emitLog('ERROR', '[t] [ERROR] boom');

    expect(received).toEqual([['ERROR', '[t] [ERROR] boom']]);
  });

  it('replaces a previously registered sink', () => {
    const first = vi.fn();
    const second = vi.fn();
    setLogSink(first);
    setLogSink(second);

    emitLog('WARN', 'line');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('WARN', 'line');
  });

  it('clears the sink when null is passed', () => {
    const sink = vi.fn();
    setLogSink(sink);
    setLogSink(null);

    emitLog('INFO', 'line');

    expect(sink).not.toHaveBeenCalled();
  });
});
