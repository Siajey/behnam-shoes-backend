export function generateOtpMessageFa(
  otp: string,
  companyName: string,
  companyUrl: string,
): string {
  return `کد تایید ${companyName}: ${otp}` + `\n` + `${companyUrl}`
}
