import { DppExtractionService } from '@/app/application/use-cases/DppExtractionService';
import { DppValidationService } from '@/app/domain/dpp/validation/DppValidationService';
import { AzureOpenAiDppExtractor } from '@/app/infrastructure/azure/AzureOpenAiDppExtractor';
import { loadAzureDppConfig } from '@/app/infrastructure/azure/azureConfig';
import { SafeLogger } from '@/app/infrastructure/logging/SafeLogger';

export function createAzureDppExtractionService(): DppExtractionService {
  const config = loadAzureDppConfig();
  const logger = new SafeLogger();

  logger.info('azure_dpp_service_configured', {
    region: config.region,
    openAiModel: config.openAi.modelName,
  });

  return new DppExtractionService({
    semanticExtractor: new AzureOpenAiDppExtractor(config.openAi, logger),
    dppValidationService: new DppValidationService(),
    logger,
  });
}
