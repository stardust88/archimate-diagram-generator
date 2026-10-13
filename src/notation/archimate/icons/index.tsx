// Icon registry (spec §8.4). Each icon is drawn in a 16x16 viewBox with stroke="currentColor";
// the figure sets `color` to the layer stroke and `--icon-fill` to the node fill. Types without
// a registered icon render the two-letter placeholder; the editor works fully with placeholders.
import type { ReactElement } from 'react';
import { ActorIcon } from './actor';
import { RoleIcon } from './role';
import { CollaborationIcon } from './collaboration';
import { InterfaceIcon } from './interface';
import { ProcessIcon } from './process';
import { FunctionIcon } from './function';
import { InteractionIcon } from './interaction';
import { EventIcon } from './event';
import { ServiceIcon } from './service';
import { ObjectIcon } from './object';
import { ContractIcon } from './contract';
import { RepresentationIcon } from './representation';
import { ProductIcon } from './product';
import { ComponentIcon } from './component';
import { NodeIcon } from './node';
import { DeviceIcon } from './device';
import { SystemSoftwareIcon } from './systemSoftware';
import { PathIcon } from './path';
import { NetworkIcon } from './network';
import { ArtifactIcon } from './artifact';
import { EquipmentIcon } from './equipment';
import { FacilityIcon } from './facility';
import { DistributionIcon } from './distribution';
import { MaterialIcon } from './material';
import { ResourceIcon } from './resource';
import { CapabilityIcon } from './capability';
import { ValueStreamIcon } from './valueStream';
import { CourseOfActionIcon } from './courseOfAction';
import { StakeholderIcon } from './stakeholder';
import { DriverIcon } from './driver';
import { AssessmentIcon } from './assessment';
import { GoalIcon } from './goal';
import { OutcomeIcon } from './outcome';
import { PrincipleIcon } from './principle';
import { RequirementIcon } from './requirement';
import { ConstraintIcon } from './constraint';
import { MeaningIcon } from './meaning';
import { ValueIcon } from './value';
import { WorkPackageIcon } from './workPackage';
import { DeliverableIcon } from './deliverable';
import { GapIcon } from './gap';
import { PlateauIcon } from './plateau';
import { LocationIcon } from './location';

export type IconComponent = () => ReactElement;

export const ICONS: Record<string, IconComponent> = {
  actor: ActorIcon,
  role: RoleIcon,
  collaboration: CollaborationIcon,
  interface: InterfaceIcon,
  process: ProcessIcon,
  function: FunctionIcon,
  interaction: InteractionIcon,
  event: EventIcon,
  service: ServiceIcon,
  object: ObjectIcon,
  contract: ContractIcon,
  representation: RepresentationIcon,
  product: ProductIcon,
  component: ComponentIcon,
  node: NodeIcon,
  device: DeviceIcon,
  systemSoftware: SystemSoftwareIcon,
  path: PathIcon,
  network: NetworkIcon,
  artifact: ArtifactIcon,
  equipment: EquipmentIcon,
  facility: FacilityIcon,
  distribution: DistributionIcon,
  material: MaterialIcon,
  resource: ResourceIcon,
  capability: CapabilityIcon,
  valueStream: ValueStreamIcon,
  courseOfAction: CourseOfActionIcon,
  stakeholder: StakeholderIcon,
  driver: DriverIcon,
  assessment: AssessmentIcon,
  goal: GoalIcon,
  outcome: OutcomeIcon,
  principle: PrincipleIcon,
  requirement: RequirementIcon,
  constraint: ConstraintIcon,
  meaning: MeaningIcon,
  value: ValueIcon,
  workPackage: WorkPackageIcon,
  deliverable: DeliverableIcon,
  gap: GapIcon,
  plateau: PlateauIcon,
  location: LocationIcon,
};
