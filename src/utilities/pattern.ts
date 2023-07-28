export function explode(str: string): RegExp{
    return new RegExp(
            str
              .split('')
              .map(c => c.charCodeAt(0))
              .map(c => '\\x' + (c < 16 ? '0' : '') + c.toString(16))
              .join('.*'),
            'i'
        );
}
  