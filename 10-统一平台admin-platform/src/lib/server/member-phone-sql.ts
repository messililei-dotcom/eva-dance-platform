// Compare the canonical value with the historic storage spelling for the same number.
export function memberPhoneKeySql(value: string) {
  return `(CASE
    WHEN ${value} GLOB '+861[3-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN substr(${value}, 4)
    WHEN ${value} GLOB '+[1-9]*' AND substr(${value}, 2) NOT GLOB '*[^0-9]*' THEN substr(${value}, 2)
    ELSE ${value} END)`;
}
