use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://api.themoviedb.org/3";

#[derive(Debug, Serialize, Deserialize)]
pub struct MovieSearchResult {
    pub id: u64,
    pub title: String,
    pub release_date: Option<String>,
    pub overview: String,
    pub poster_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TmdbSearchResponse {
    results: Vec<MovieSearchResult>,
}

pub fn search_movie(query: &str, api_key: &str) -> Result<Vec<MovieSearchResult>, String> {
    let url = format!(
        "{}/search/movie?api_key={}&query={}&language=fr-FR",
        BASE_URL, api_key, query
    );

    let response = reqwest::blocking::get(&url).map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API Error: {}", response.status()));
    }

    let search_response: TmdbSearchResponse =
        response.json().map_err(|e| format!("Parse error: {}", e))?;

    Ok(search_response.results)
}
