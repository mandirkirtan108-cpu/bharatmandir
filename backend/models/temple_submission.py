from typing import Any, Dict, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class TempleSubmissionBase(
    BaseModel
):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )


class TempleSubmissionCreate(
    TempleSubmissionBase
):
    temple_name: str = Field(
        default="Untitled Temple Draft",
        min_length=1,
        max_length=255,
    )

    deity: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    temple_type: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    district: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    pincode: Optional[str] = Field(
        default=None,
        max_length=10,
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=10000,
    )

    history: Optional[str] = Field(
        default=None,
        max_length=15000,
    )

    timings: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    contact_phone: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    image_url: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    form_payload: Dict[str, Any] = Field(
        default_factory=dict,
    )

    @field_validator(
        "deity",
        "temple_type",
        "district",
        "pincode",
        "description",
        "history",
        "timings",
        "contact_phone",
        "image_url",
        "address",
        "city",
        "state",
        mode="before",
    )
    @classmethod
    def convert_empty_to_none(
        cls,
        value,
    ):
        if isinstance(value, str):
            value = value.strip()

            if not value:
                return None

        return value

    @field_validator("pincode")
    @classmethod
    def validate_pincode(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        if not value.isdigit():
            raise ValueError(
                "Pincode must contain only numbers"
            )

        if len(value) not in {5, 6}:
            raise ValueError(
                "Pincode must contain 5 or 6 digits"
            )

        return value

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        allowed_characters = set(
            "0123456789+-() "
        )

        if not set(value).issubset(
            allowed_characters
        ):
            raise ValueError(
                "Contact phone contains invalid characters"
            )

        return value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        if not value.startswith(
            ("http://", "https://")
        ):
            raise ValueError(
                "Image URL must start with http:// or https://"
            )

        return value


class TempleSubmissionUpdate(
    TempleSubmissionBase
):
    temple_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
    )

    deity: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    temple_type: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    address: Optional[str] = Field(
        default=None,
        min_length=5,
        max_length=1000,
    )

    city: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=120,
    )

    district: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    state: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=120,
    )

    pincode: Optional[str] = Field(
        default=None,
        max_length=10,
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=10000,
    )

    history: Optional[str] = Field(
        default=None,
        max_length=15000,
    )

    timings: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    contact_phone: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    image_url: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    form_payload: Optional[Dict[str, Any]] = None

    @field_validator("pincode")
    @classmethod
    def validate_pincode(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        value = value.strip()

        if not value:
            return None

        if not value.isdigit():
            raise ValueError(
                "Pincode must contain only numbers"
            )

        if len(value) not in {5, 6}:
            raise ValueError(
                "Pincode must contain 5 or 6 digits"
            )

        return value

    @field_validator("contact_phone")
    @classmethod
    def validate_contact_phone(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        value = value.strip()

        if not value:
            return None

        allowed_characters = set(
            "0123456789+-() "
        )

        if not set(value).issubset(
            allowed_characters
        ):
            raise ValueError(
                "Contact phone contains invalid characters"
            )

        return value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return value

        value = value.strip()

        if not value:
            return None

        if not value.startswith(
            ("http://", "https://")
        ):
            raise ValueError(
                "Image URL must start with http:// or https://"
            )

        return value


class ReviewRequest(
    TempleSubmissionBase
):
    action: Literal[
        "approved",
        "rejected",
        "changes_requested",
    ]

    admin_note: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    @field_validator(
        "admin_note",
        mode="before",
    )
    @classmethod
    def normalize_admin_note(
        cls,
        value,
    ):
        if isinstance(value, str):
            value = value.strip()

            if not value:
                return None

        return value
