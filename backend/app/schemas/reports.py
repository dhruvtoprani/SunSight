from pydantic import BaseModel, Field


class ReportGenerateRequest(BaseModel):
    report_id: str | None = None
    project: dict = Field(default_factory=dict)
    layout: dict = Field(default_factory=dict)
    solar: dict = Field(default_factory=dict)
    financial: dict = Field(default_factory=dict)


class ReportGenerateResponse(BaseModel):
    report_id: str
    format: str = "json"
    title: str
    summary: dict
    disclaimer: str

