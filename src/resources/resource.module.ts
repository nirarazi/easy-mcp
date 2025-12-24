import { Module } from "@nestjs/common";
import { ResourceRegistryService } from "./resource-registry.service";

@Module({
  providers: [ResourceRegistryService],
  exports: [ResourceRegistryService],
})
export class ResourceModule {}

