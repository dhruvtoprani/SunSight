from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter

from app.schemas.project import ProjectCreate, ProjectRecord

router = APIRouter(prefix="/projects", tags=["projects"])

_PROJECTS: dict[str, ProjectRecord] = {}


@router.post("", response_model=ProjectRecord)
def create_project(request: ProjectCreate) -> ProjectRecord:
    project = ProjectRecord(
        project_id=f"proj_{uuid4().hex[:10]}",
        created_at=datetime.now(timezone.utc),
        **request.model_dump(),
    )
    _PROJECTS[project.project_id] = project
    return project


@router.get("", response_model=list[ProjectRecord])
def list_projects() -> list[ProjectRecord]:
    return list(_PROJECTS.values())


@router.get("/{project_id}", response_model=ProjectRecord)
def get_project(project_id: str) -> ProjectRecord:
    return _PROJECTS[project_id]

