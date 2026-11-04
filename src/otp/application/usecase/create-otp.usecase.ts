import {IOtpRepository} from "../../domain";
import {IPasswordHasher} from "@common/security";
import {ICreateOtpUseCase} from "../index";

export default class CreateOtpUseCase implements ICreateOtpUseCase{
    constructor(
        private readonly otpRepo: IOtpRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(phoneNumber: string, rawCode: string) {
        const codeHash = await this.passwordHasher.hash(rawCode)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

        return this.otpRepo.create({
            phoneNumber,
            codeHash,
            expiresAt,
        })
    }
}