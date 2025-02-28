import React, { useEffect, useRef, useCallback, useState } from "react";
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import "babylonjs-loaders"; // Babylon.js ローダー (CSVなどのファイル形式を扱うために必要) をインポート
import { workerData } from "worker_threads";
import { isNumberObject } from "util/types";
import { Collapse, CollapseProps } from "antd";
import imgGatsby from "./howtomakehmcsv.png";

const items: CollapseProps["items"] = [
  {
    key: "1",
    label: "Mediapipeのメタデータ",
    children: (
        <pre>
          <code>
            {`===HORRORMON_META_START===
{
"keypoeint_connections": [
{ "from_keypoint": "NOSE", "to_keypoint": "LEFT_EYE" },
{ "from_keypoint": "NOSE", "to_keypoint": "RIGHT_EYE" },
{ "from_keypoint": "LEFT_EYE", "to_keypoint": "LEFT_EAR" },
{ "from_keypoint": "RIGHT_EYE", "to_keypoint": "RIGHT_EAR" },
{ "from_keypoint": "NOSE", "to_keypoint": "NECK" },
{ "from_keypoint": "NECK", "to_keypoint": "LEFT_SHOULDER" },
{ "from_keypoint": "LEFT_SHOULDER", "to_keypoint": "LEFT_ELBOW" },
{ "from_keypoint": "LEFT_ELBOW", "to_keypoint": "LEFT_WRIST" },
{ "from_keypoint": "NECK", "to_keypoint": "RIGHT_SHOULDER" },
{ "from_keypoint": "RIGHT_SHOULDER", "to_keypoint": "RIGHT_ELBOW" },
{ "from_keypoint": "RIGHT_ELBOW", "to_keypoint": "RIGHT_WRIST" },
{ "from_keypoint": "NECK", "to_keypoint": "LEFT_HIP" },
{ "from_keypoint": "LEFT_HIP", "to_keypoint": "LEFT_KNEE" },
{ "from_keypoint": "LEFT_KNEE", "to_keypoint": "LEFT_ANKLE" },
{ "from_keypoint": "NECK", "to_keypoint": "RIGHT_HIP" },
{ "from_keypoint": "RIGHT_HIP", "to_keypoint": "RIGHT_KNEE" },
{ "from_keypoint": "RIGHT_KNEE", "to_keypoint": "RIGHT_ANKLE" },
{ "from_keypoint": "LEFT_HIP", "to_keypoint": "RIGHT_HIP" },
{ "from_keypoint": "LEFT_ANKLE", "to_keypoint": "LEFT_HEEL" },
{ "from_keypoint": "LEFT_ANKLE", "to_keypoint": "LEFT_FOOT_INDEX" },
{ "from_keypoint": "RIGHT_ANKLE", "to_keypoint": "RIGHT_HEEL" },
{ "from_keypoint": "RIGHT_ANKLE", "to_keypoint": "RIGHT_FOOT_INDEX" },
{ "from_keypoint": "LEFT_SHOULDER", "to_keypoint": "LEFT_PINKY" },
{ "from_keypoint": "LEFT_WRIST", "to_keypoint": "LEFT_PINKY" },
{ "from_keypoint": "LEFT_SHOULDER", "to_keypoint": "LEFT_INDEX" },
{ "from_keypoint": "LEFT_WRIST", "to_keypoint": "LEFT_INDEX" },
{ "from_keypoint": "LEFT_SHOULDER", "to_keypoint": "LEFT_THUMB" },
{ "from_keypoint": "LEFT_WRIST", "to_keypoint": "LEFT_THUMB" },
{ "from_keypoint": "RIGHT_SHOULDER", "to_keypoint": "RIGHT_PINKY" },
{ "from_keypoint": "RIGHT_WRIST", "to_keypoint": "RIGHT_PINKY" },
{ "from_keypoint": "RIGHT_SHOULDER", "to_keypoint": "RIGHT_INDEX" },
{ "from_keypoint": "RIGHT_WRIST", "to_keypoint": "RIGHT_INDEX" },
{ "from_keypoint": "RIGHT_SHOULDER", "to_keypoint": "RIGHT_THUMB" },
{ "from_keypoint": "RIGHT_WRIST", "to_keypoint": "RIGHT_THUMB" }
]
}
===HORRORMON_META_END===`}
          </code>
        </pre>
    ),
  },
  {
    key: "2",
    label: "MMPoseのcocoモデル用のメタデータ",
    children: 
      <pre>
        <code>
          {`===HORRORMON_META_START===
{
"keypoeint_connections": [
{ "from_keypoint": "root", "to_keypoint": "spine" },
{ "from_keypoint": "spine", "to_keypoint": "thorax" },
{ "from_keypoint": "thorax", "to_keypoint": "neck_base" },
{ "from_keypoint": "neck_base", "to_keypoint": "head" },
{ "from_keypoint": "root", "to_keypoint": "right_hip" },
{ "from_keypoint": "right_hip", "to_keypoint": "right_knee" },
{ "from_keypoint": "right_knee", "to_keypoint": "right_foot" },
{ "from_keypoint": "root", "to_keypoint": "left_hip" },
{ "from_keypoint": "left_hip", "to_keypoint": "left_knee" },
{ "from_keypoint": "left_knee", "to_keypoint": "left_foot" },
{ "from_keypoint": "thorax", "to_keypoint": "right_shoulder" },
{ "from_keypoint": "right_shoulder", "to_keypoint": "right_elbow" },
{ "from_keypoint": "right_elbow", "to_keypoint": "right_wrist" },
{ "from_keypoint": "thorax", "to_keypoint": "left_shoulder" },
{ "from_keypoint": "left_shoulder", "to_keypoint": "left_elbow" },
{ "from_keypoint": "left_elbow", "to_keypoint": "left_wrist" }
]
}
===HORRORMON_META_END===`}
        </code>
      </pre>,
  },
];

// Viewer コンポーネントの実装 (関数コンポーネント)
const MetadataExamples: React.FC = () => {
  // JSX: コンポーネントの描画内容
  return (<>
  <h2>関節間に線を描画する方法</h2>
  1. 可視化したいデータのCSVをテキスト編集ソフトで開く <br/>
  2. テキストの先頭に以下に挙げる例を追加する <br/>
  <pre>
    <code>
      <img src={imgGatsby} style={{width: "95vw"} } />
    </code>
  </pre>
  3. ファイル名の拡張子を .csv から .hmcsv に変更する <br/>
  <Collapse items={items}  />
  </>
  );
};

export default MetadataExamples; // Viewer コンポーネントを export (他のコンポーネントから利用可能にする)
