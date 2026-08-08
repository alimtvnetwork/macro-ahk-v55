export interface ProjectGroup {
  Id: number;
  Name: string;
  SharedSettingsJson: string | null;
  CreatedAt: string;
}

export interface ProjectGroupMember {
  Id: number;
  GroupId: number;
  ProjectIdUuid: string;
}
