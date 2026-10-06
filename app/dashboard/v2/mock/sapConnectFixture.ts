/** Battery-focused SAP OData mock for onboarding (not generic chemicals sample). */
export const MOCK_SAP_BATTERY_ODATA = {
  d: {
    Product: 'TV-NMC-52-001',
    NetWeight: '52.000',
    WeightUnit: 'KG',
    CountryOfOrigin: 'DE',
    to_Description: {
      results: [{ Language: 'DE', ProductDescription: 'PowerCell Pro NMC 5.2 kWh Modul' }],
    },
    StandardIdentifier: {
      ProductStandardID: '4260123456789',
      InternationalArticleNumberCat: 'EAN',
    },
  },
} as const;
