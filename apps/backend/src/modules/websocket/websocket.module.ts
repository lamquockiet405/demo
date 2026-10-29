import { Module } from '@nestjs/common';
import { KitchenGateway } from './kitchen.gateway';
import { RootGateway } from './root.gateway';

@Module({
  providers: [KitchenGateway, RootGateway],
  exports: [KitchenGateway, RootGateway],
})
export class WebsocketModule {}
