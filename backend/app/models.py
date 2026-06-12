"""
Pydantic mirror of the ScreenDocument — light structural validation only.
No calculation logic lives here.
"""
from __future__ import annotations
from typing import Literal, Optional, Union
from pydantic import BaseModel


class RangeSpec(BaseModel):
    kind: Literal['range']
    low: float
    high: float


class ListSpec(BaseModel):
    kind: Literal['list']
    values: list[float]


ValueSpec = Union[RangeSpec, ListSpec]

ConcUnit = Literal['M', 'mM', 'uM', '%w/v', '%v/v', 'mg/mL', 'X']


class ReagentAxis(BaseModel):
    type: Literal['reagent']
    name: str
    stockConc: float
    unit: ConcUnit
    targetUnit: Optional[ConcUnit] = None
    values: ValueSpec


class PhAxis(BaseModel):
    type: Literal['ph']
    bufferName: str
    concentration: float
    concUnit: ConcUnit
    stockConc: float
    stockUnit: ConcUnit
    pKa: float
    pH: ValueSpec
    prepMode: Literal['individual', 'mixing']


AxisDef = Optional[Union[ReagentAxis, PhAxis]]


class ConstantAdditive(BaseModel):
    name: str
    stockConc: float
    unit: ConcUnit
    targetUnit: Optional[ConcUnit] = None
    targetConc: float


class PlateSpec(BaseModel):
    rows: int
    cols: int
    wellVolume: float
    volumeUnit: Literal['uL', 'mL']
    rowOffset: Optional[int] = None
    colOffset: Optional[int] = None


class ScreenMeta(BaseModel):
    name: Optional[str] = None
    sample: Optional[str] = None
    operator: Optional[str] = None
    temperatureC: Optional[float] = None
    notes: Optional[str] = None


class EngineConfig(BaseModel):
    minPipetteVolumeUL: Optional[float] = None
    pipetteResolutionUL: Optional[float] = None
    deadVolumeMultiplier: Optional[float] = None


class ScreenDocument(BaseModel):
    version: Literal[1]
    meta: ScreenMeta
    plate: PlateSpec
    axes: dict[Literal['x', 'y'], AxisDef]
    constants: list[ConstantAdditive]
    config: Optional[EngineConfig] = None
