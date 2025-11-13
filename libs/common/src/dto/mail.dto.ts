import { IsEmail, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class MailJobDataDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsObject()
  context: Record<string, unknown>;
}
