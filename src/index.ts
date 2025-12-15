import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { InferenceClient } from '@huggingface/inference'
import { z } from 'zod'

// Greeting message for "개발동생"
// Hello, 개발동생! 👋 Nice to meet you! Hope you're having a great day coding!

// Create server instance
const serverName = 'YOUR_SERVER_NAME'
const serverVersion = '1.0.0'
const server = new McpServer({
    name: serverName,
    version: serverVersion
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 계산 결과를 반환합니다.',
        inputSchema: z.object({
            a: z.number().describe('첫 번째 숫자'),
            b: z.number().describe('두 번째 숫자'),
            operator: z.enum(['+', '-', '*', '/']).describe('연산자 (+, -, *, /)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ a, b, operator }) => {
        let result: number
        switch (operator) {
            case '+':
                result = a + b
                break
            case '-':
                result = a - b
                break
            case '*':
                result = a * b
                break
            case '/':
                if (b === 0) {
                    throw new Error('0으로 나눌 수 없습니다')
                }
                result = a / b
                break
            default:
                throw new Error('지원하지 않는 연산자입니다')
        }
        const resultText = `${a} ${operator} ${b} = ${result}`
        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'time',
    {
        description: 'timezone을 입력받아 해당 timezone의 현재 시간을 반환합니다.',
        inputSchema: z.object({
            timezone: z.string().describe('IANA timezone (예: Asia/Seoul, America/New_York, Europe/London)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 시간')
                    })
                )
                .describe('현재 시간')
        })
    },
    async ({ timezone }) => {
        try {
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })
            const timeString = formatter.format(now)
            const resultText = `${timezone}의 현재 시간: ${timeString}`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            throw new Error(`유효하지 않은 timezone입니다: ${timezone}`)
        }
    }
)

server.registerTool(
    'geocode',
    {
        description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다.',
        inputSchema: z.object({
            address: z.string().describe('도시 이름이나 주소 (예: 서울, New York, Paris)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표')
                    })
                )
                .describe('위도와 경도 좌표')
        })
    },
    async ({ address }) => {
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search')
            url.searchParams.set('q', address)
            url.searchParams.set('format', 'json')
            url.searchParams.set('limit', '1')

            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'MCP-Server/1.0 (mcp-server@example.com)'
                }
            })

            if (!response.ok) {
                throw new Error(`Nominatim API 요청 실패: ${response.status}`)
            }

            const data = await response.json()

            if (!data || data.length === 0) {
                throw new Error(`주소를 찾을 수 없습니다: ${address}`)
            }

            const { lat, lon, display_name } = data[0]
            const resultText = `주소: ${display_name}\n위도: ${lat}\n경도: ${lon}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            throw new Error(`지오코딩 실패: ${(error as Error).message}`)
        }
    }
)

server.registerTool(
    'weather',
    {
        description: '위도, 경도, 시간대 및 예보 일수를 기반으로 날씨 정보를 가져옵니다.',
        inputSchema: z.object({
            latitude: z.number().describe('위도 (예: 37.5665)'),
            longitude: z.number().describe('경도 (예: 126.9780)'),
            timezone: z.string().optional().default('auto').describe('IANA timezone (예: Asia/Seoul, America/New_York). 기본값: auto'),
            forecastDays: z.number().optional().default(7).describe('예보 일수 (1-16, 기본값: 7)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, timezone = 'auto', forecastDays = 7 }) => {
        try {
            // 예보 일수 유효성 검사
            const days = Math.max(1, Math.min(16, forecastDays))

            const url = new URL('https://api.open-meteo.com/v1/forecast')
            url.searchParams.set('latitude', latitude.toString())
            url.searchParams.set('longitude', longitude.toString())
            url.searchParams.set('timezone', timezone === 'auto' ? 'auto' : timezone)
            url.searchParams.set('forecast_days', days.toString())
            url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode')

            const response = await fetch(url.toString())

            if (!response.ok) {
                throw new Error(`Open-Meteo API 요청 실패: ${response.status}`)
            }

            const data = await response.json()

            if (!data.daily) {
                throw new Error('날씨 데이터를 가져올 수 없습니다')
            }

            const { daily } = data
            const dates = daily.time as string[]
            const maxTemps = daily.temperature_2m_max as number[]
            const minTemps = daily.temperature_2m_min as number[]
            const precipitations = daily.precipitation_sum as number[]
            const weathercodes = daily.weathercode as number[]

            // 날씨 코드를 텍스트로 변환하는 함수
            const getWeatherDescription = (code: number): string => {
                const weatherMap: Record<number, string> = {
                    0: '맑음',
                    1: '대체로 맑음',
                    2: '부분적으로 흐림',
                    3: '흐림',
                    45: '안개',
                    48: '서리 안개',
                    51: '약한 이슬비',
                    53: '중간 이슬비',
                    55: '강한 이슬비',
                    56: '약한 동결 이슬비',
                    57: '강한 동결 이슬비',
                    61: '약한 비',
                    63: '중간 비',
                    65: '강한 비',
                    66: '약한 동결 비',
                    67: '강한 동결 비',
                    71: '약한 눈',
                    73: '중간 눈',
                    75: '강한 눈',
                    77: '눈알',
                    80: '약한 소나기',
                    81: '중간 소나기',
                    82: '강한 소나기',
                    85: '약한 눈 소나기',
                    86: '강한 눈 소나기',
                    95: '뇌우',
                    96: '우박과 함께 뇌우',
                    99: '강한 우박과 함께 뇌우'
                }
                return weatherMap[code] || `코드 ${code}`
            }

            let resultText = `위도: ${latitude}, 경도: ${longitude}\n시간대: ${timezone}\n예보 일수: ${days}일\n\n`
            resultText += '날씨 예보:\n'
            resultText += '─'.repeat(50) + '\n'

            for (let i = 0; i < dates.length; i++) {
                const date = new Date(dates[i])
                const dateStr = date.toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short'
                })
                resultText += `${dateStr}\n`
                resultText += `  날씨: ${getWeatherDescription(weathercodes[i])}\n`
                resultText += `  최고 기온: ${maxTemps[i].toFixed(1)}°C\n`
                resultText += `  최저 기온: ${minTemps[i].toFixed(1)}°C\n`
                resultText += `  강수량: ${precipitations[i].toFixed(1)}mm\n`
                resultText += '\n'
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            throw new Error(`날씨 정보 조회 실패: ${(error as Error).message}`)
        }
    }
)

server.registerTool(
    'code-review-prompt',
    {
        description: '코드를 입력받아 코드 리뷰를 위한 프롬프트를 생성합니다.',
        inputSchema: z.object({
            code: z.string().describe('리뷰할 코드'),
            language: z.string().optional().describe('프로그래밍 언어 (예: TypeScript, Python, JavaScript)'),
            focusAreas: z
                .array(z.string())
                .optional()
                .describe('특별히 집중할 리뷰 영역 (예: ["성능", "보안", "가독성"])')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('코드 리뷰 프롬프트')
                    })
                )
                .describe('코드 리뷰 프롬프트')
        })
    },
    async ({ code, language, focusAreas }) => {
        // 코드 리뷰 프롬프트 템플릿
        const codeReviewTemplate = `다음 코드를 리뷰해주세요.

## 코드
\`\`\`${language || ''}
${code}
\`\`\`

## 리뷰 요청 사항
다음 항목들을 중심으로 코드를 검토해주세요:

1. **코드 품질**
   - 코드 가독성과 명확성
   - 네이밍 컨벤션 준수 여부
   - 코드 구조와 조직화

2. **기능성**
   - 로직의 정확성
   - 엣지 케이스 처리
   - 에러 핸들링

3. **성능**
   - 알고리즘 효율성
   - 불필요한 연산이나 중복 코드
   - 메모리 사용 최적화

4. **보안**
   - 잠재적 보안 취약점
   - 입력 검증 및 sanitization
   - 민감한 정보 노출 위험

5. **유지보수성**
   - 코드 재사용성
   - 테스트 가능성
   - 문서화 및 주석

${focusAreas && focusAreas.length > 0 ? `\n## 특별 집중 영역\n${focusAreas.map((area, index) => `${index + 1}. ${area}`).join('\n')}\n` : ''}

## 리뷰 형식
다음 형식으로 리뷰를 작성해주세요:

### 👍 잘된 점
- [긍정적인 피드백]

### 🔍 개선 사항
- [개선이 필요한 부분과 이유]

### 💡 제안 사항
- [구체적인 개선 방안]

### ⚠️ 잠재적 문제
- [주의가 필요한 부분]

감사합니다!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: codeReviewTemplate
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: codeReviewTemplate
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'generate-image',
    {
        description: '프롬프트를 입력받아 AI로 이미지를 생성합니다.',
        inputSchema: z.object({
            prompt: z.string().describe('이미지 생성을 위한 텍스트 프롬프트')
        })
    },
    async ({ prompt }) => {
        try {
            // Hugging Face 토큰 확인
            if (!process.env.HF_TOKEN) {
                throw new Error('HF_TOKEN 환경변수가 설정되지 않았습니다')
            }

            // Hugging Face Inference 클라이언트 생성
            const client = new InferenceClient(process.env.HF_TOKEN)

            // 이미지 생성 요청 (Hugging Face Serverless Inference API)
            const imageBlob = await client.textToImage({
                provider: 'auto',
                model: 'black-forest-labs/FLUX.1-schnell',
                inputs: prompt
            })

            // Blob을 ArrayBuffer로 변환 후 base64 인코딩
            const arrayBuffer = await (imageBlob as unknown as Blob).arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const base64Data = buffer.toString('base64')

            return {
                content: [
                    {
                        type: 'image' as const,
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                ]
            }
        } catch (error) {
            throw new Error(
                `이미지 생성 중 오류가 발생했습니다: ${
                    error instanceof Error ? error.message : '알 수 없는 오류'
                }`
            )
        }
    }
)

// 서버 시작 시간 기록
const serverStartTime = new Date()

// 업타임을 읽기 쉬운 형식으로 변환하는 함수
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    const parts: string[] = []
    if (days > 0) parts.push(`${days}일`)
    if (hours > 0) parts.push(`${hours}시간`)
    if (minutes > 0) parts.push(`${minutes}분`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}초`)

    return parts.join(' ')
}

// 서버 정보 리소스 등록
server.resource(
    'server-info',
    'server://info',
    {
        description: '현재 서버 정보와 사용 가능한 도구 목록',
        mimeType: 'application/json'
    },
    async () => {
        const serverInfo = {
            server: {
                name: serverName,
                version: serverVersion,
                startTime: serverStartTime.toISOString(),
                uptime: process.uptime(),
                uptimeFormatted: formatUptime(process.uptime())
            },
            tools: [
                {
                    name: 'greet',
                    description: '이름과 언어를 입력하면 인사말을 반환합니다.'
                },
                {
                    name: 'calculator',
                    description: '두 개의 숫자와 연산자를 입력받아 계산 결과를 반환합니다.'
                },
                {
                    name: 'time',
                    description: 'timezone을 입력받아 해당 timezone의 현재 시간을 반환합니다.'
                },
                {
                    name: 'geocode',
                    description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다.'
                },
                {
                    name: 'weather',
                    description: '위도, 경도, 시간대 및 예보 일수를 기반으로 날씨 정보를 가져옵니다.'
                },
                {
                    name: 'code-review-prompt',
                    description: '코드를 입력받아 코드 리뷰를 위한 프롬프트를 생성합니다.'
                },
                {
                    name: 'generate-image',
                    description: '프롬프트를 입력받아 AI로 이미지를 생성합니다.'
                }
            ],
            resources: [
                {
                    uri: 'server://info',
                    name: '서버 정보',
                    description: '현재 서버 정보와 사용 가능한 도구 목록'
                }
            ],
            timestamp: new Date().toISOString()
        }

        return {
            contents: [
                {
                    uri: 'server://info',
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
