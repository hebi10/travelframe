#!/usr/bin/env python3
"""Offline, deterministic UI-R00 data states for disposable Android QA devices."""
from copy import deepcopy
import json

STATES = (
    "no-project", "project-no-photo", "project-one-photo",
    "project-three-photos", "project-many-photos", "three-projects",
    "video-empty", "guest", "first-run"
)

KEY_PROJECTS = "body-frame.projects.v1"
KEY_PHOTOS = "travel-frame.photos.v1"
KEY_METRICS = "body-frame.measurements.v1"
KEY_METRIC_SETTINGS = "body-frame.measurement-settings.v1"
KEY_VIDEOS = "travel-frame.videos.v1"


def build_state(qa, app_dir, state, font="medium", theme="dark"):
    """Return encoded AsyncStorage state, additional private JPEG files and expected counts.

    Reuses the app's existing QA-only fixtures, never user records or live credentials.
    No mutation of current app or the source fixtures.
    """
    if state not in STATES:
        raise ValueError("Unknown UI-R00 sample state: " + str(state))
    encoded = qa.fixture_values(
        app_dir, populated=(state != "no-project"),
        font_size=font, theme_mode=theme, intro_seen=state != "first-run"
    )
    projects = json.loads(encoded[KEY_PROJECTS])
    photos = json.loads(encoded[KEY_PHOTOS])
    metrics = json.loads(encoded[KEY_METRICS])
    settings = json.loads(encoded[KEY_METRIC_SETTINGS])
    extra_media = []

    if state == "project-no-photo":
        photos = []
        metrics = []
        projects[0].pop("coverPhotoId", None)
    elif state == "project-one-photo":
        photos = photos[:1]
        metrics = metrics[:1]
        projects[0]["coverPhotoId"] = photos[0]["id"]
    elif state == "project-many-photos":
        original_photos = deepcopy(photos)
        original_metrics = deepcopy(metrics)
        for number in range(4, 13):
            origin = (number - 1) % 3
            photo = deepcopy(original_photos[origin])
            identifier = "qa-r00-photo-" + str(number)
            photo.update(
                id=identifier, projectId=qa.PROJECT, sequence=number,
                createdAt=f"2026-11-{number:02d}T09:00:00.000Z",
                uri=f"file://{app_dir}/files/photos/{qa.PROJECT}/photo-{identifier}.jpg",
                previewUri=f"file://{app_dir}/files/photo-previews/{qa.PROJECT}/photo-{identifier}.jpg"
            )
            metric = deepcopy(original_metrics[origin])
            metric.update(
                id="qa-r00-measure-" + str(number),
                projectId=qa.PROJECT, photoId=identifier, sequence=number,
                recordedAt=photo["createdAt"]
            )
            photos.append(photo)
            metrics.append(metric)
            extra_media.append((qa.PROJECT, identifier, origin + 1))
        projects[0]["coverPhotoId"] = photos[-1]["id"]
        projects[0]["updatedAt"] = photos[-1]["createdAt"]
    elif state == "three-projects":
        original_photos = deepcopy(photos)
        original_metrics = deepcopy(metrics)
        for project_number in (2, 3):
            project_id = "qa-r00-project-" + str(project_number)
            project = deepcopy(projects[0])
            project.update(
                id=project_id, name="QA 데모 · 프로젝트 " + str(project_number),
                createdAt=f"2026-10-{project_number:02d}T09:00:00.000Z",
                updatedAt=f"2026-11-{project_number:02d}T09:00:00.000Z"
            )
            for number in range(1, 4):
                origin = number - 1
                identifier = f"qa-r00-p{project_number}-photo-{number}"
                photo = deepcopy(original_photos[origin])
                photo.update(
                    id=identifier, projectId=project_id, sequence=number,
                    uri=f"file://{app_dir}/files/photos/{project_id}/photo-{identifier}.jpg",
                    previewUri=f"file://{app_dir}/files/photo-previews/{project_id}/photo-{identifier}.jpg"
                )
                metric = deepcopy(original_metrics[origin])
                metric.update(
                    id=f"qa-r00-p{project_number}-measure-{number}",
                    projectId=project_id, photoId=identifier, sequence=number
                )
                photos.append(photo)
                metrics.append(metric)
                extra_media.append((project_id, identifier, number))
            project["coverPhotoId"] = f"qa-r00-p{project_number}-photo-3"
            projects.append(project)
            settings[project_id] = deepcopy(settings[qa.PROJECT])

    # Both the empty video library and guest state are already represented by
    # the existing offline QA fixture. No fake video or authenticated account.
    assert not json.loads(encoded[KEY_VIDEOS]), "QA fixture unexpectedly includes user videos"
    encoded[KEY_PROJECTS] = json.dumps(projects, ensure_ascii=False)
    encoded[KEY_PHOTOS] = json.dumps(photos, ensure_ascii=False)
    encoded[KEY_METRICS] = json.dumps(metrics, ensure_ascii=False)
    encoded[KEY_METRIC_SETTINGS] = json.dumps(settings, ensure_ascii=False)
    if not projects:
        encoded.pop("body-frame.last-active-project-id.v1", None)

    valid_ids = {p["id"] for p in projects}
    assert all(photo["projectId"] in valid_ids for photo in photos)
    assert len({p["id"] for p in photos}) == len(photos)
    assert len({m["id"] for m in metrics}) == len(metrics)
    assert all(m["photoId"] in {p["id"] for p in photos} for m in metrics)
    counts = {
        "projects": len(projects),
        "photos": len(photos),
        "measurements": len(metrics),
        "videos": len(json.loads(encoded[KEY_VIDEOS])),
        "guest": True,
        "firstRun": state == "first-run",
    }
    return encoded, extra_media, counts
