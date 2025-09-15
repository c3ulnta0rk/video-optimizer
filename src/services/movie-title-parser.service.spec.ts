import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MovieTitleParserService, MovieInfo, ParsedTitle, MovieSearchResult } from './movie-title-parser.service';
import { SettingsService } from './settings.service';
import { of } from 'rxjs';

describe('MovieTitleParserService', () => {
  let service: MovieTitleParserService;
  let httpTestingController: HttpTestingController;
  let mockSettingsService: jasmine.SpyObj<SettingsService>;

  beforeEach(() => {
    mockSettingsService = jasmine.createSpyObj('SettingsService', ['getTmdbApiKey']);
    mockSettingsService.getTmdbApiKey.and.returnValue('test-api-key');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MovieTitleParserService,
        { provide: SettingsService, useValue: mockSettingsService }
      ]
    });

    service = TestBed.inject(MovieTitleParserService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('File Name Cleaning', () => {
    it('should clean movie file name with extension', () => {
      const fileName = 'Movie.Name.2023.1080p.BluRay.x264-GROUP.mkv';
      const cleaned = (service as any).cleanFileName(fileName);
      
      expect(cleaned).toBe('Movie Name 2023 1080p BluRay x264-GROUP');
    });

    it('should handle multiple file extensions', () => {
      const testCases = [
        { input: 'movie.mp4', expected: 'movie' },
        { input: 'movie.mkv', expected: 'movie' },
        { input: 'movie.avi', expected: 'movie' },
        { input: 'movie.mov', expected: 'movie' },
        { input: 'movie.wmv', expected: 'movie' },
        { input: 'movie.flv', expected: 'movie' },
        { input: 'movie.webm', expected: 'movie' }
      ];

      testCases.forEach(testCase => {
        const cleaned = (service as any).cleanFileName(testCase.input);
        expect(cleaned).toBe(testCase.expected);
      });
    });

    it('should normalize dots and spaces', () => {
      const fileName = 'Movie...Name....2023...1080p';
      const cleaned = (service as any).cleanFileName(fileName);
      
      expect(cleaned).toBe('Movie Name 2023 1080p');
    });
  });

  describe('Title Parsing', () => {
    it('should parse movie with year and group pattern', () => {
      const fileName = 'Avengers Endgame 2019 1080p BluRay x264-GROUP';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('Avengers Endgame');
      expect(parsed.year).toBe(2019);
      expect(parsed.quality).toBe('1080p BluRay x264');
      expect(parsed.group).toBe('GROUP');
      expect(parsed.originalName).toBe(fileName);
    });

    it('should parse TV show with season and episode', () => {
      const fileName = 'Game of Thrones S08E06 1080p BluRay x264-GROUP';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('Game of Thrones');
      expect(parsed.season).toBe(8);
      expect(parsed.episode).toBe(6);
      expect(parsed.quality).toBe('1080p BluRay x264');
      expect(parsed.group).toBe('GROUP');
    });

    it('should parse simple movie with year in parentheses', () => {
      const fileName = 'The Matrix (1999)';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('The Matrix');
      expect(parsed.year).toBe(1999);
    });

    it('should parse movie with dots instead of spaces', () => {
      const fileName = 'The.Dark.Knight.2008.1080p.BluRay.x264';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('The Dark Knight');
      expect(parsed.year).toBe(2008);
      expect(parsed.quality).toBe('1080p BluRay x264');
    });

    it('should handle simple title without year', () => {
      const fileName = 'Movie Title';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('Movie Title');
      expect(parsed.year).toBeUndefined();
    });

    it('should fallback to original name for complex patterns', () => {
      const fileName = 'Complex.Movie.Name.With.No.Clear.Pattern';
      const parsed = (service as any).parseFileName(fileName);
      
      expect(parsed.title).toBe('Complex Movie Name With No Clear Pattern');
      expect(parsed.originalName).toBe(fileName);
    });
  });

  describe('Title Cleaning', () => {
    it('should remove quality indicators', () => {
      const title = 'Movie Title 1080p BluRay HDRip BRRip';
      const cleaned = (service as any).cleanTitle(title);
      
      expect(cleaned).toBe('Movie Title');
    });

    it('should remove codec information', () => {
      const title = 'Movie Title x264 x265 XviD DivX AAC AC3 DTS MP3';
      const cleaned = (service as any).cleanTitle(title);
      
      expect(cleaned).toBe('Movie Title');
    });

    it('should normalize separators and spaces', () => {
      const title = 'Movie_Title-With.Various-Separators';
      const cleaned = (service as any).cleanTitle(title);
      
      expect(cleaned).toBe('Movie Title With Various Separators');
    });

    it('should handle mixed quality and codec indicators', () => {
      const title = 'Movie Title 720p x264 BluRay AAC DTS';
      const cleaned = (service as any).cleanTitle(title);
      
      expect(cleaned).toBe('Movie Title');
    });
  });

  describe('Year Extraction', () => {
    it('should extract year from valid date string', () => {
      const year = (service as any).extractYearFromDate('2023-05-15');
      expect(year).toBe(2023);
    });

    it('should handle invalid date strings', () => {
      const year = (service as any).extractYearFromDate('invalid-date');
      expect(year).toBeUndefined();
    });

    it('should handle empty date strings', () => {
      const year = (service as any).extractYearFromDate('');
      expect(year).toBeUndefined();
    });

    it('should handle undefined date strings', () => {
      const year = (service as any).extractYearFromDate(undefined);
      expect(year).toBeUndefined();
    });
  });

  describe('TMDB Integration', () => {
    it('should search movie on TMDB successfully', (done) => {
      const fileName = 'Avengers Endgame 2019 1080p BluRay';
      const mockResponse = {
        results: [
          {
            id: 299534,
            title: 'Avengers: Endgame',
            release_date: '2019-04-24',
            poster_path: '/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
            overview: 'After the devastating events...',
            vote_average: 8.3
          }
        ]
      };

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Avengers: Endgame');
        expect(result.year).toBe(2019);
        expect(result.type).toBe('movie');
        expect(result.tmdbId).toBe(299534);
        expect(result.confidence).toBeGreaterThan(0.8);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie') && !!req.params.get('query')?.includes('Avengers Endgame')
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should search TV show on TMDB successfully', (done) => {
      const fileName = 'Game of Thrones S01E01 1080p BluRay';
      const mockResponse = {
        results: [
          {
            id: 1399,
            name: 'Game of Thrones',
            first_air_date: '2011-04-17',
            poster_path: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
            overview: 'Seven noble families fight...'
          }
        ]
      };

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Game of Thrones');
        expect(result.year).toBe(2011);
        expect(result.type).toBe('tv');
        expect(result.tmdbId).toBe(1399);
        expect(result.confidence).toBeGreaterThan(0.8);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/tv') && !!req.params.get('query')?.includes('Game of Thrones')
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should handle TMDB API key not configured', (done) => {
      mockSettingsService.getTmdbApiKey.and.returnValue('');
      const fileName = 'Movie Title 2023';

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Movie Title');
        expect(result.year).toBe(2023);
        expect(result.type).toBe('movie');
        expect(result.confidence).toBe(0.6);
        done();
      });
    });

    it('should handle TMDB search failure', (done) => {
      const fileName = 'Unknown Movie 2023';

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Unknown Movie');
        expect(result.year).toBe(2023);
        expect(result.type).toBe('movie');
        expect(result.confidence).toBe(0.6);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle empty TMDB results', (done) => {
      const fileName = 'Non Existent Movie 2023';
      const mockResponse = { results: [] };

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Non Existent Movie');
        expect(result.year).toBe(2023);
        expect(result.type).toBe('movie');
        expect(result.confidence).toBe(0.5);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.flush(mockResponse);
    });
  });

  describe('Movie Details', () => {
    it('should get movie details from TMDB', (done) => {
      const tmdbId = 299534;
      const type = 'movie';
      const mockResponse = {
        id: 299534,
        title: 'Avengers: Endgame',
        overview: 'After the devastating events...',
        runtime: 181,
        genres: [{ id: 28, name: 'Action' }],
        credits: { cast: [], crew: [] }
      };

      service.getMovieDetails(tmdbId, type).subscribe(result => {
        expect(result).toEqual(mockResponse);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes(`/movie/${tmdbId}`) && !!req.params.get('append_to_response')
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should get TV show details from TMDB', (done) => {
      const tmdbId = 1399;
      const type = 'tv';
      const mockResponse = {
        id: 1399,
        name: 'Game of Thrones',
        overview: 'Seven noble families...',
        number_of_seasons: 8,
        genres: [{ id: 18, name: 'Drama' }]
      };

      service.getMovieDetails(tmdbId, type).subscribe(result => {
        expect(result).toEqual(mockResponse);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes(`/tv/${tmdbId}`)
      );
      req.flush(mockResponse);
    });

    it('should handle API key not configured for details', (done) => {
      mockSettingsService.getTmdbApiKey.and.returnValue('');

      service.getMovieDetails(123, 'movie').subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toBe('Clé API TMDB non configurée');
          done();
        }
      });
    });
  });

  describe('Search with Alternatives', () => {
    it('should search movie with alternatives', (done) => {
      const fileName = 'Avengers 2019';
      const mockResponse = {
        results: [
          {
            id: 299534,
            title: 'Avengers: Endgame',
            release_date: '2019-04-24',
            popularity: 100,
            vote_average: 8.3,
            overview: 'After the devastating events...'
          },
          {
            id: 24428,
            title: 'The Avengers',
            release_date: '2012-04-25',
            popularity: 80,
            vote_average: 7.7,
            overview: 'When an unexpected enemy...'
          }
        ]
      };

      service.searchMovieWithAlternatives(fileName).subscribe(result => {
        expect(result.selected.title).toBe('Avengers: Endgame');
        expect(result.alternatives).toHaveSize(2);
        expect(result.originalQuery).toBe('Avengers');
        expect(result.selected.popularity).toBe(100);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.flush(mockResponse);
    });

    it('should handle search with alternatives when no API key', (done) => {
      mockSettingsService.getTmdbApiKey.and.returnValue('');
      const fileName = 'Movie Title 2023';

      service.searchMovieWithAlternatives(fileName).subscribe(result => {
        expect(result.selected.title).toBe('Movie Title');
        expect(result.alternatives).toHaveSize(0);
        expect(result.originalQuery).toBe('Movie Title');
        done();
      });
    });

    it('should handle search failure gracefully', (done) => {
      const fileName = 'Movie Title 2023';

      service.searchMovieWithAlternatives(fileName).subscribe(result => {
        expect(result.selected.title).toBe('Movie Title');
        expect(result.alternatives).toHaveSize(0);
        expect(result.originalQuery).toBe('Movie Title');
        expect(result.selected.confidence).toBe(0.6);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Custom Keywords Search', () => {
    it('should search with custom keywords', (done) => {
      const customQuery = 'Matrix';
      const year = 1999;
      const mockResponse = {
        results: [
          {
            id: 603,
            title: 'The Matrix',
            release_date: '1999-03-30',
            popularity: 95,
            vote_average: 8.7,
            overview: 'Set in the 22nd century...'
          }
        ]
      };

      service.searchMovieWithCustomKeywords(customQuery, 'movie', year).subscribe(result => {
        expect(result.selected.title).toBe('The Matrix');
        expect(result.selected.year).toBe(1999);
        expect(result.alternatives).toHaveSize(1);
        expect(result.originalQuery).toBe('Matrix');
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie') && req.params.get('year') === '1999'
      );
      req.flush(mockResponse);
    });

    it('should search TV shows with custom keywords', (done) => {
      const customQuery = 'Breaking Bad';
      const mockResponse = {
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            first_air_date: '2008-01-20',
            popularity: 90,
            vote_average: 9.5,
            overview: 'A high school chemistry teacher...'
          }
        ]
      };

      service.searchMovieWithCustomKeywords(customQuery, 'tv').subscribe(result => {
        expect(result.selected.title).toBe('Breaking Bad');
        expect(result.selected.type).toBe('tv');
        expect(result.alternatives).toHaveSize(1);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/tv')
      );
      req.flush(mockResponse);
    });

    it('should handle custom search without API key', (done) => {
      mockSettingsService.getTmdbApiKey.and.returnValue('');
      const customQuery = 'Test Movie';

      service.searchMovieWithCustomKeywords(customQuery, 'movie', 2023).subscribe(result => {
        expect(result.selected.title).toBe('Test Movie');
        expect(result.selected.year).toBe(2023);
        expect(result.alternatives).toHaveSize(0);
        expect(result.selected.confidence).toBe(0.6);
        done();
      });
    });

    it('should handle custom search failure', (done) => {
      const customQuery = 'Non Existent Movie';

      service.searchMovieWithCustomKeywords(customQuery, 'movie').subscribe(result => {
        expect(result.selected.title).toBe('Non Existent Movie');
        expect(result.alternatives).toHaveSize(0);
        expect(result.selected.confidence).toBe(0.6);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Complex File Name Patterns', () => {
    it('should handle various movie file patterns', () => {
      const testCases = [
        {
          input: 'The.Matrix.1999.1080p.BluRay.x264-GROUP.mkv',
          expectedTitle: 'The Matrix',
          expectedYear: 1999
        },
        {
          input: 'Avengers Endgame (2019) 1080p BluRay x264-GROUP.mp4',
          expectedTitle: 'Avengers Endgame',
          expectedYear: 2019
        },
        {
          input: 'Game.of.Thrones.S08E06.1080p.BluRay.x264-GROUP.mkv',
          expectedTitle: 'Game of Thrones',
          expectedSeason: 8,
          expectedEpisode: 6
        },
        {
          input: 'Breaking Bad S05E14 1080p BluRay x264-GROUP.avi',
          expectedTitle: 'Breaking Bad',
          expectedSeason: 5,
          expectedEpisode: 14
        },
        {
          input: 'Simple Movie Title.mp4',
          expectedTitle: 'Simple Movie Title'
        }
      ];

      testCases.forEach(testCase => {
        const cleaned = (service as any).cleanFileName(testCase.input);
        const parsed = (service as any).parseFileName(cleaned);

        expect(parsed.title).toBe(testCase.expectedTitle);
        if (testCase.expectedYear) {
          expect(parsed.year).toBe(testCase.expectedYear);
        }
        if (testCase.expectedSeason) {
          expect(parsed.season).toBe(testCase.expectedSeason);
        }
        if (testCase.expectedEpisode) {
          expect(parsed.episode).toBe(testCase.expectedEpisode);
        }
      });
    });
  });

  describe('Fallback Scenarios', () => {
    it('should handle unparseable file names', (done) => {
      const fileName = 'ComplexFileName.WithoutClearPattern.xyz';

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('ComplexFileName WithoutClearPattern');
        expect(result.type).toBe('movie');
        expect(result.confidence).toBe(0.1);
        done();
      });
    });

    it('should provide fallback when TMDB search has no results', (done) => {
      const fileName = 'Unknown Movie 2023 1080p';
      const mockResponse = { results: [] };

      service.parseMovieTitle(fileName).subscribe(result => {
        expect(result.title).toBe('Unknown Movie');
        expect(result.year).toBe(2023);
        expect(result.type).toBe('movie');
        expect(result.confidence).toBe(0.5);
        done();
      });

      const req = httpTestingController.expectOne(req => 
        req.url.includes('/search/movie')
      );
      req.flush(mockResponse);
    });
  });
});