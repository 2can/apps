import { PrivateMetadataAppConfigurator } from "./app-configurator";
import { createSettingsManager } from "../../lib/metadata-manager";
import { ChannelsFetcher } from "../channels/channels-fetcher";
import { ShopInfoFetcher } from "../shop-info/shop-info-fetcher";
import { FallbackAppConfig } from "./fallback-app-config";
import { Client } from "urql";
import { createLogger } from "@saleor/apps-shared";

export class GetAppConfigurationService {
  constructor(
    private settings: {
      apiClient: Client;
      saleorApiUrl: string;
    }
  ) {}

  async getConfiguration() {
    const logger = createLogger({
      service: "GetAppConfigurationService",
      saleorApiUrl: this.settings.saleorApiUrl,
    });

    const { saleorApiUrl, apiClient } = this.settings;

    const appConfigurator = new PrivateMetadataAppConfigurator(
      createSettingsManager(apiClient),
      saleorApiUrl
    );

    const savedAppConfig = (await appConfigurator.getConfig()) ?? null;

    logger.debug(savedAppConfig, "Retrieved app config from Metadata. Will return it");

    if (savedAppConfig) {
      return savedAppConfig;
    }

    logger.info("App config not found in metadata. Will create default config now.");

    const channelsFetcher = new ChannelsFetcher(apiClient);
    const shopInfoFetcher = new ShopInfoFetcher(apiClient);

    const [channels, shopUrlConfiguration] = await Promise.all([
      channelsFetcher.fetchChannels(),
      shopInfoFetcher.fetchShopInfo(),
    ]);

    logger.debug(channels, "Fetched channels");
    logger.debug(shopUrlConfiguration, "Fetched shop url configuration");

    const appConfig = FallbackAppConfig.createFallbackConfigFromExistingShopAndChannels(
      channels ?? [],
      shopUrlConfiguration
    );

    logger.debug(appConfig, "Created a fallback AppConfig. Will save it.");

    await appConfigurator.setConfig(appConfig);

    logger.info("Saved initial AppConfig");

    return appConfig;
  }
}
