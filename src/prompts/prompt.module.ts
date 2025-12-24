import { Module } from "@nestjs/common";
import { PromptRegistryService } from "./prompt-registry.service";

@Module({
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class PromptModule {}

