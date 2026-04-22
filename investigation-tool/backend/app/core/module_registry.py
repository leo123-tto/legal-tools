from __future__ import annotations

from app.modules.asset_clue_module import AssetClueModule
from app.modules.basic_info_module import BasicInfoModule
from app.modules.bidding_module import BiddingModule
from app.modules.case_deep_dive_module import CaseDeepDiveModule
from app.modules.key_case_filter_module import KeyCaseFilterModule
from app.modules.litigation_module import LitigationModule
from app.modules.related_companies_module import RelatedCompaniesModule
from app.modules.report_generation_module import ReportGenerationModule
from app.modules.restriction_module import RestrictionModule


def get_registered_modules() -> list:
    return [
        BasicInfoModule(),
        RestrictionModule(),
        RelatedCompaniesModule(),
        LitigationModule(),
        KeyCaseFilterModule(),
        CaseDeepDiveModule(),
        BiddingModule(),
        AssetClueModule(),
        ReportGenerationModule(),
    ]
