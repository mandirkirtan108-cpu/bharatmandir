from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class VolunteerBaseModel(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )


class VolunteerSignup(
    VolunteerBaseModel
):
    name: str = Field(
        min_length=2,
        max_length=120,
    )

    email: EmailStr

    password: str = Field(
        min_length=6,
        max_length=128,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    @field_validator(
        "phone",
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

    @field_validator("phone")
    @classmethod
    def validate_phone(
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
                "Phone number contains invalid characters"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 8:
            raise ValueError(
                "Phone number must contain at least 8 digits"
            )

        return value


class VolunteerLogin(
    VolunteerBaseModel
):
    email: EmailStr

    password: str = Field(
        min_length=6,
        max_length=128,
    )


class RefreshRequest(
    VolunteerBaseModel
):
    refresh_token: str = Field(
        min_length=20
    )


class VolunteerProfileUpdate(
    VolunteerBaseModel
):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=120,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    @field_validator(
        "phone",
        "city",
        "state",
        mode="before",
    )
    @classmethod
    def normalize_optional_fields(
        cls,
        value,
    ):
        if isinstance(value, str):
            value = value.strip()

            if not value:
                return None

        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(
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
                "Phone number contains invalid characters"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 8:
            raise ValueError(
                "Phone number must contain at least 8 digits"
            )

        return value 