import { DppExtractionService } from '@/app/application/use-cases/DppExtractionService';
import { DppValidationService } from '@/app/domain/dpp/validation/DppValidationService';
import { AzureOpenAiDppExtractor } from '@/app/infrastructure/azure/AzureOpenAiDppExtractor';
import { loadAzureDppConfig } from '@/app/infrastructure/azure/azureConfig';
import { OpenAiRegulatoryDppExtractor } from '@/app/infrastructure/openai/OpenAiRegulatoryDppExtractor';
import { SafeLogger } from '@/app/infrastructure/logging/SafeLogger';

export function createAzureDppExtractionService(): DppExtractionService {
  const config = loadAzureDppConfig();
  const logger = new SafeLogger();

  logger.info('azure_dpp_service_configured', {
    region: config.region,
    openAiModel: config.openAi.modelName,
  });

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const regulatoryStructuredExtractor = openAiKey
    ? new OpenAiRegulatoryDppExtractor({ apiKey: openAiKey, logger })
    : undefined;

  return new DppExtractionService({
    semanticExtractor: new AzureOpenAiDppExtractor(config.openAi, logger),
    dppValidationService: new DppValidationService(),
    logger,
    regulatoryStructuredExtractor,
  });
}
