import React, { useState, useCallback } from "react";
import Papa from "papaparse";
import { Button, message } from "antd";
import { horror_mon_metadata } from "../entities/horror_mon_metadata";

interface CsvUploaderProps {
  onDataLoaded: (data: any[], header: string[],metadata:horror_mon_metadata) => void;
  onError: (error: string) => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onDataLoaded, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setIsLoading(true);
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
          let csvText = e.target?.result as string;
          let metaheader : horror_mon_metadata = new horror_mon_metadata();

          //もし、Horrormon用ヘッダーがあったらヘッダー解析
          //ヘッダーの構造はhorror_mon_headerをjson化したもの
          const startKeyword = "===HORRORMON_META_START===";
          const endKeyword = "===HORRORMON_META_END===";
          if(csvText.startsWith(startKeyword)){
            let headerEndIndex = csvText.indexOf(endKeyword);
            let headerText = csvText.substring(0,headerEndIndex).replace(startKeyword,'');
            console.log(headerText);
            metaheader = JSON.parse(headerText);
            csvText = csvText.substring(headerText.length+startKeyword.length+endKeyword.length+2 //+1は改行文字
                                          ,csvText.length);
            console.log(metaheader);
          }
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            complete: function (results) {
              let data = results.data;
              if (
                data.length > 0 &&
                data[data.length - 1].length === 1 &&
                data[data.length - 1][0] === null
              ) {
                data.pop();
              }
              onDataLoaded(data, results.meta.fields as string[],metaheader);
              setIsLoading(false);
              messageApi.success("CSV file parsed successfully!");
            },
            error: function (error) {
              console.error("CSVファイルの解析エラー:", error);
              onError(error.message);
              setIsLoading(false);
              messageApi.error("Failed to parse CSV file.");
            },
          });
        };
        reader.onerror = function (error) {
          console.error("ファイル読み込みエラー:", error);
          onError(error.message);
          setIsLoading(false);
          messageApi.error("Failed to read CSV file.");
        };
        reader.readAsText(file);
      } else {
        setIsLoading(false);
      }
    },
    [onDataLoaded, onError]
  );

  return (
    <div>
      {contextHolder}
      <input
        type="file"
        id="csvUpload"
        onChange={handleFileUpload}
        disabled={isLoading}
      />
      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default CsvUploader;