/**
 * Automotive master data: Brand → Model → Article Code
 */
export const MASTER_DATA = {
  Toyota: {
    Corolla: ["COR-GLI-2026", "COR-XLI-2026", "COR-HYB-2026"],
    Camry: ["CAM-SE-2026", "CAM-XLE-2026", "CAM-HYB-2026"],
    Yaris: ["YAR-GL-2026", "YAR-GLX-2026"],
    Prado: ["PRA-TXL-2026", "PRA-GXL-2026", "PRA-VXR-2026"],
    Hilux: ["HIL-DX-2026", "HIL-GLX-2026"],
    Hiace: ["HIA-STD-2026", "HIA-GL-2026"],
    "Land Cruiser": ["LC-GXR-2026", "LC-VXR-2026"],
  },
  Honda: {
    CRVEX485CM: ["CRV-EX-485-CM", "CRV-EX-485-DMS"],
    CRVEX485DMS: ["CRV-EX-485-DMS", "CRV-EX-485-EMS"],
    ACLAT263CEZ: ["ACL-AT263-CEZ", "ACL-AT263-FEX"],
    ACLXA262FEX: ["ACL-XA262-FEX", "ACL-XA262-GLX"],
    CRVEX485EMS: ["CRV-EX-485-EMS", "CRV-EX-485-FMS"],
    CRVEX485FMS: ["CRV-EX-485-FMS", "CRV-EX-485-GMS"],
  },
  Lexus: {
    ES: ["ES-250-2026", "ES-300H-2026"],
    IS: ["IS-300-2026", "IS-350-FSPORT-2026"],
    NX: ["NX-250-2026", "NX-350H-2026"],
    RX: ["RX-350-2026", "RX-500H-2026"],
    LX: ["LX-600-2026", "LX-600-FSPORT-2026"],
  },
  Nissan: {
    Sunny: ["SUN-S-2026", "SUN-SV-2026"],
    Altima: ["ALT-S-2026", "ALT-SL-2026"],
    Patrol: ["PAT-SE-2026", "PAT-TITANIUM-2026"],
    "X-Trail": ["XTR-S-2026", "XTR-SL-2026"],
    Kicks: ["KIC-S-2026", "KIC-SV-2026"],
  },
  Suzuki: {
    Swift: ["SWI-GL-2026", "SWI-GLX-2026"],
    Baleno: ["BAL-GL-2026", "BAL-GLX-2026"],
    Dzire: ["DZI-GL-2026", "DZI-GLX-2026"],
    Jimny: ["JIM-MT-2026", "JIM-AT-2026"],
    Ertiga: ["ERT-GL-2026", "ERT-GLX-2026"],
  },
};

export const BRAND_MODELS = Object.fromEntries(
  Object.entries(MASTER_DATA).map(([brand, models]) => [brand, Object.keys(models)])
);

export const BRANDS = Object.keys(MASTER_DATA);

export function getModelsForBrand(brand) {
  return BRAND_MODELS[brand] || [];
}

export function isValidBrandModel(brand, model) {
  return getModelsForBrand(brand).includes(model);
}

export function getArticleCodesForModel(brand, model) {
  return MASTER_DATA[brand]?.[model] || [];
}

export function isValidModelArticle(brand, model, articleCode) {
  return getArticleCodesForModel(brand, model).includes(articleCode);
}
