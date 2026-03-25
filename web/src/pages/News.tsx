import NewsPanel from '../components/NewsPanel'

export default function News() {
    return (
        <div className="space-y-6">
            <NewsPanel title="Economic News & Currency Impact" days={3} />
        </div>
    )
}
