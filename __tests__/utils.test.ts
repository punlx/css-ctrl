import { buildVariableName } from '../src/client/utils/buildVariableName';
import { parseDisplayName } from '../src/client/utils/parseDisplayName';
import { parseVariableAbbr } from '../src/client/utils/parseVariableAbbr';
import { flushAll, pushSetAction, pushRemoveAction, waitForNextFlush } from '../src/client/utils/flushAll';
import { parseClassBlocksWithBraceCounting } from '../src/client/parser/parseClassBlocksWithBraceCounting';

describe('buildVariableName', () => {
  test('returns empty string when scope is none', () => {
    expect(buildVariableName('bg', 'none', 'box', '')).toBe('');
  });

  test('handles suffix and no suffix', () => {
    expect(buildVariableName('bg', 'app', 'box', '')).toBe('--bg-app_box');
    expect(buildVariableName('bg', 'app', 'box', 'hover')).toBe('--bg-app_box-hover');
  });
});

describe('parseDisplayName', () => {
  test('without underscore returns none scope', () => {
    expect(parseDisplayName('foo')).toEqual({ scope: 'none', cls: 'foo' });
  });

  test('splits on underscore', () => {
    expect(parseDisplayName('app_box')).toEqual({ scope: 'app', cls: 'box' });
  });
});

describe('parseVariableAbbr', () => {
  test('handles no dash', () => {
    expect(parseVariableAbbr('bg')).toEqual({ baseVarName: 'bg', suffix: '' });
  });

  test('splits on last dash', () => {
    expect(parseVariableAbbr('bg-color')).toEqual({ baseVarName: 'bg', suffix: 'color' });
    expect(parseVariableAbbr('bg-dark-color')).toEqual({ baseVarName: 'bg-dark', suffix: 'color' });
  });
});

describe('parseClassBlocksWithBraceCounting', () => {
  test('extracts class blocks', () => {
    const css = `\n.card { color: red; }\n.btn { background: blue; }`;
    const blocks = parseClassBlocksWithBraceCounting(css);
    expect(blocks).toEqual([
      { className: 'card', body: 'color: red;' },
      { className: 'btn', body: 'background: blue;' },
    ]);
  });
});

describe('flushAll utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('set and remove actions apply via rAF', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    pushSetAction('--color', 'red', el);
    await jest.runOnlyPendingTimersAsync();
    await waitForNextFlush();
    expect(el.style.getPropertyValue('--color')).toBe('red');

    pushRemoveAction('--color', el);
    await jest.runOnlyPendingTimersAsync();
    await waitForNextFlush();
    expect(el.style.getPropertyValue('--color')).toBe('');
  });

  test('waitForNextFlush resolves immediately when nothing scheduled', async () => {
    await expect(waitForNextFlush()).resolves.toBeUndefined();
  });
});
