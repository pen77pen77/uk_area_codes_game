import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import Papa from "papaparse";
import "leaflet/dist/leaflet.css";
import "./styles.css";

// --- COMPONENTS ---

// 1. Map Zoom Component
function MapFocus({ location, animate }) {
  const map = useMap();
  useEffect(() => {
    if (location && animate) {
      map.flyTo([location.latitude, location.longitude], 10, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [location, animate, map]);
  return null;
}

export default function App() {
  const [areaCodes, setAreaCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- APP NAVIGATION ---
  const [appSection, setAppSection] = useState("GAME");

  // --- GAME STATE ---
  const [mode, setMode] = useState(
    () => localStorage.getItem("uk_codes_mode") || "nameToCode"
  );
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [autoNext, setAutoNext] = useState(() =>
    JSON.parse(localStorage.getItem("uk_codes_auto_next") || "true")
  );
  const [shouldZoom, setShouldZoom] = useState(false);
  const [showAllDots, setShowAllDots] = useState(() =>
    JSON.parse(localStorage.getItem("uk_codes_show_dots") || "true")
  );

  // --- REFS ---
  const inputRef = useRef(null);
  const markerRefs = useRef({});

  // --- DICTIONARY STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightCode, setHighlightCode] = useState(null);

  const [dictStatus, setDictStatus] = useState(() => {
    const saved = localStorage.getItem("uk_codes_dict_status");
    return saved ? JSON.parse(saved) : {};
  });

  // --- SAVE SYSTEM ---

  // 1. Mastered (Green)
  const [correctList, setCorrectList] = useState(() => {
    const saved = localStorage.getItem("uk_codes_mastered");
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Review List (Orange)
  const [reviewList, setReviewList] = useState(() => {
    const saved = localStorage.getItem("uk_codes_review");
    return saved ? JSON.parse(saved) : [];
  });

  // 3. Mistakes
  const [mistakeCount, setMistakeCount] = useState(() => {
    const saved = localStorage.getItem("uk_codes_mistakes");
    return saved ? parseInt(saved, 10) : 0;
  });

  // Save Effects
  useEffect(() => {
    localStorage.setItem("uk_codes_mastered", JSON.stringify(correctList));
  }, [correctList]);
  useEffect(() => {
    localStorage.setItem("uk_codes_review", JSON.stringify(reviewList));
  }, [reviewList]);
  useEffect(() => {
    localStorage.setItem("uk_codes_mistakes", mistakeCount.toString());
  }, [mistakeCount]);
  useEffect(() => {
    localStorage.setItem("uk_codes_dict_status", JSON.stringify(dictStatus));
  }, [dictStatus]);

  useEffect(() => {
    localStorage.setItem("uk_codes_mode", mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem("uk_codes_auto_next", JSON.stringify(autoNext));
  }, [autoNext]);
  useEffect(() => {
    localStorage.setItem("uk_codes_show_dots", JSON.stringify(showAllDots));
  }, [showAllDots]);

  // Load CSV
  useEffect(() => {
    Papa.parse("/uk_codes.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanData = results.data
          .filter((row) => row["Phone Code"] && row.Latitude && row.Longitude)
          .map((row) => {
            let cleanCode = row["Phone Code"];
            if (!cleanCode.startsWith("0")) cleanCode = "0" + cleanCode;
            return {
              code: cleanCode,
              place: row["Area"],
              latitude: parseFloat(row.Latitude),
              longitude: parseFloat(row.Longitude),
            };
          });

        const uniqueCodes = [];
        const seen = new Set();
        cleanData.forEach((item) => {
          if (!seen.has(item.code)) {
            uniqueCodes.push(item);
            seen.add(item.code);
          }
        });

        uniqueCodes.sort((a, b) => a.place.localeCompare(b.place));
        setAreaCodes(uniqueCodes);
        setLoading(false);
      },
    });
  }, []);

  // --- GAME LOGIC ---
  const generateQuestion = (specificPlace = null) => {
    setFeedback("");
    setUserInput("");

    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);

    if (specificPlace) {
      setCurrentQuestion(specificPlace);
      setShouldZoom(false);
      return;
    }

    const pending = areaCodes.filter(
      (item) => !correctList.includes(item.code)
    );
    if (pending.length === 0) {
      setFeedback("🎉 You have mastered EVERY UK code!");
      setCurrentQuestion(null);
      return;
    }
    const nextQ = pending[Math.floor(Math.random() * pending.length)];
    setCurrentQuestion(nextQ);
    setShouldZoom(true);
  };

  useEffect(() => {
    if (
      appSection === "GAME" &&
      !loading &&
      areaCodes.length > 0 &&
      !currentQuestion
    ) {
      generateQuestion();
    }
  }, [loading, areaCodes, appSection]);

  const addToReviewList = (code) => {
    if (!reviewList.includes(code)) {
      setReviewList([...reviewList, code]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentQuestion) return;

    let isCorrect = false;
    // Remove spaces for lenient checking
    let inputClean = userInput.replace(/\s+/g, "").toLowerCase();

    if (mode === "nameToCode") {
      let answerClean = currentQuestion.code.replace(/\s+/g, "").toLowerCase();
      if (!inputClean.startsWith("0")) inputClean = "0" + inputClean;
      if (inputClean === answerClean) isCorrect = true;
    } else {
      if (currentQuestion.place.toLowerCase().includes(inputClean))
        isCorrect = true;
    }

    if (isCorrect) {
      setFeedback("✅ Correct!");
      if (!correctList.includes(currentQuestion.code)) {
        setCorrectList([...correctList, currentQuestion.code]);
      }
      if (autoNext) {
        setTimeout(() => generateQuestion(), 1000);
      } else {
        setFeedback("✅ Correct! Select next location on map.");
      }
    } else {
      setFeedback("❌ Incorrect. Try again!");
      setMistakeCount((prev) => prev + 1);

      addToReviewList(currentQuestion.code); // Mark Orange

      if (inputRef.current) inputRef.current.focus();
    }
  };

  const revealAnswer = () => {
    setMistakeCount((prev) => prev + 1);
    addToReviewList(currentQuestion.code); // Mark Orange
    setFeedback(
      `The answer is: ${
        mode === "nameToCode" ? currentQuestion.code : currentQuestion.place
      }`
    );
  };

  const resetProgress = () => {
    if (
      window.confirm(
        "Are you sure? This will wipe GAME progress (Green dots). Dictionary status will be kept."
      )
    ) {
      setCorrectList([]);
      setReviewList([]);
      setMistakeCount(0);
      localStorage.removeItem("uk_codes_mastered");
      localStorage.removeItem("uk_codes_review");
      localStorage.removeItem("uk_codes_mistakes");
      generateQuestion();
    }
  };

  // --- DICTIONARY LOGIC ---
  const cycleStatus = (e, code) => {
    e.stopPropagation();
    const currentStatus = dictStatus[code] || 0;
    const nextStatus = (currentStatus + 1) % 3;
    setDictStatus((prev) => ({ ...prev, [code]: nextStatus }));
  };

  const jumpToLocation = (location) => {
    setCurrentQuestion(location);
    setShouldZoom(true);
    const marker = markerRefs.current[location.code];
    if (marker) {
      marker.openPopup();
    }
  };

  const filteredDictionary = useMemo(() => {
    return areaCodes.filter(
      (item) =>
        item.place.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.replace(/\s+/g, "").includes(searchTerm)
    );
  }, [areaCodes, searchTerm]);

  if (loading) return <div style={{ padding: 20 }}>Loading Data...</div>;

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>🇬🇧 Code Master</h2>

        <div className="nav-switcher">
          <button
            className={appSection === "GAME" ? "active" : ""}
            onClick={() => setAppSection("GAME")}
          >
            🎮 Play
          </button>
          <button
            className={appSection === "DICTIONARY" ? "active" : ""}
            onClick={() => setAppSection("DICTIONARY")}
          >
            📖 Dictionary
          </button>
        </div>

        {/* ================= GAME MODE UI ================= */}
        {appSection === "GAME" && (
          <div className="game-panel">
            <div className="progress-container">
              <div className="progress-text">
                <span>Mastered</span>
                <span>
                  {correctList.length} / {areaCodes.length}
                </span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className={`progress-bar-fill ${
                    correctList.length === areaCodes.length ? "complete" : ""
                  }`}
                  style={{
                    width: `${(correctList.length / areaCodes.length) * 100}%`,
                  }}
                ></div>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#888",
                  marginTop: "5px",
                  textAlign: "right",
                }}
              >
                Mistakes: <span style={{ color: "red" }}>{mistakeCount}</span>
              </div>
            </div>

            <div className="mode-toggle">
              <button
                onClick={() => setMode("nameToCode")}
                className={mode === "nameToCode" ? "active-mode" : ""}
              >
                Place ➡️ Code
              </button>
              <button
                onClick={() => setMode("codeToName")}
                className={mode === "codeToName" ? "active-mode" : ""}
              >
                Code ➡️ Place
              </button>
            </div>

            <div className="quiz-box">
              {currentQuestion ? (
                <form onSubmit={handleSubmit}>
                  <div className="question-text">
                    {mode === "nameToCode"
                      ? `Code for: ${currentQuestion.place}`
                      : `Place for: ${currentQuestion.code}`}
                  </div>

                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    autoFocus
                    placeholder="Type here..."
                    ref={inputRef}
                  />

                  <button type="submit" className="check-btn">
                    Check Answer
                  </button>
                </form>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "green",
                    fontWeight: "bold",
                  }}
                >
                  🏆 Map Complete!
                </div>
              )}
              <div className="feedback">{feedback}</div>
              {currentQuestion && (
                <div className="action-row">
                  {autoNext && (
                    <button
                      type="button"
                      onClick={() => generateQuestion()}
                      className="secondary-btn"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={revealAnswer}
                    className="secondary-btn"
                  >
                    Give Up & Reveal
                  </button>
                </div>
              )}
            </div>

            <div className="settings">
              <h4>Settings</h4>
              <label>
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={() => setAutoNext(!autoNext)}
                />
                Auto-Next (Random Jump)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showAllDots}
                  onChange={() => setShowAllDots(!showAllDots)}
                />
                Show Mastered (Green)
              </label>

              <button onClick={resetProgress} className="reset-btn">
                Reset Game Progress
              </button>

              {/* CREDIT LINK ADDED HERE */}
              <div
                style={{
                  marginTop: "20px",
                  fontSize: "11px",
                  color: "#999",
                  textAlign: "center",
                }}
              >
                Data sourced from{" "}
                <a
                  href="https://www.doogal.co.uk/UKPhoneCodes"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#999", textDecoration: "underline" }}
                >
                  doogal.co.uk
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================= DICTIONARY MODE UI ================= */}
        {appSection === "DICTIONARY" && (
          <div className="dictionary-container">
            <input
              type="text"
              placeholder="Search Place or Code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <div className="stats-summary">
              <span className="dot grey"></span> New
              <span className="dot blue" style={{ marginLeft: 10 }}></span>{" "}
              Learning
              <span
                className="dot green"
                style={{ marginLeft: 10 }}
              ></span>{" "}
              Done
            </div>

            <div className="dictionary-list">
              {filteredDictionary.map((item) => {
                const status = dictStatus[item.code] || 0;

                let statusColor = "#ddd";
                let statusText = "New";
                if (status === 1) {
                  statusColor = "#3498db";
                  statusText = "Learning";
                }
                if (status === 2) {
                  statusColor = "#2ecc71";
                  statusText = "Done";
                }

                return (
                  <div
                    key={item.code}
                    className="dict-item"
                    onClick={() => jumpToLocation(item)}
                    onMouseEnter={() => setHighlightCode(item.code)}
                    onMouseLeave={() => setHighlightCode(null)}
                  >
                    <div className="dict-info">
                      <div className="dict-place">{item.place}</div>
                      <div className="dict-code">{item.code}</div>
                    </div>
                    <div className="dict-actions">
                      <button
                        className="status-toggle-btn"
                        style={{
                          backgroundColor: statusColor,
                          color: status === 0 ? "#333" : "white",
                        }}
                        onClick={(e) => cycleStatus(e, item.code)}
                      >
                        {statusText}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="map-area">
        <MapContainer
          center={[54.0, -2.5]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

          <MapFocus location={currentQuestion} animate={shouldZoom} />

          {areaCodes.map((location) => {
            const isGameMastered = correctList.includes(location.code);
            const isReview = reviewList.includes(location.code);
            const isGameCurrent =
              appSection === "GAME" &&
              currentQuestion &&
              currentQuestion.code === location.code;
            const dictState = dictStatus[location.code] || 0;
            const isHighlighted = highlightCode === location.code;

            let color = "#888";
            let fillColor = "#888";
            let opacity = 0.5;
            let radius = 5;
            let weight = 1;

            if (appSection === "GAME") {
              if (isGameMastered) {
                color = "#2ecc71";
                fillColor = "#2ecc71";
              } else if (isReview) {
                color = "#f39c12"; // Orange for mistakes
                fillColor = "#f39c12";
              }

              if (isGameCurrent) {
                color = "#e74c3c";
                fillColor = "#e74c3c";
                opacity = 1;
                radius = 8;
                weight = 3;
              }
              if (!showAllDots && isGameMastered) return null;
            } else {
              if (dictState === 1) {
                color = "#3498db";
                fillColor = "#3498db";
                opacity = 0.8;
              }
              if (dictState === 2) {
                color = "#2ecc71";
                fillColor = "#2ecc71";
                opacity = 0.8;
              }

              if (isHighlighted) {
                color = "#f1c40f";
                fillColor = "#f1c40f";
                opacity = 1;
                radius = 9;
                weight = 4;
              }
            }

            return (
              <CircleMarker
                key={location.code}
                center={[location.latitude, location.longitude]}
                pathOptions={{ color, fillColor, fillOpacity: opacity, weight }}
                radius={radius}
                ref={(el) => (markerRefs.current[location.code] = el)}
                eventHandlers={{
                  click: () => generateQuestion(location),
                  mouseover: (e) => {
                    if (appSection === "DICTIONARY") e.target.openPopup();
                  },
                  mouseout: (e) => {
                    if (appSection === "DICTIONARY") e.target.closePopup();
                  },
                }}
              >
                <Popup>
                  {appSection === "DICTIONARY" || isGameMastered ? (
                    <>
                      <strong>{location.place}</strong>
                      <br />
                      {location.code}
                    </>
                  ) : mode === "nameToCode" ? (
                    <>
                      <strong>{location.place}</strong>
                      <br />
                      ???
                    </>
                  ) : (
                    <>
                      <strong>???</strong>
                      <br />
                      {location.code}
                    </>
                  )}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
